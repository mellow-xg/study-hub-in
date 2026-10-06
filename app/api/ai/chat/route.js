import {
  consumeRateLimit,
  createServiceClient,
  jsonResponse,
  readJsonBody,
  requireAuth,
  validateText,
  writeAuditLog,
} from "../../../../lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/auto";
const MAX_HISTORY = 20;

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const rate = await consumeRateLimit({
    userId: auth.user.id,
    bucket: "ai_chat",
    limit: 10,
    windowSeconds: 600,
  });

  if (!rate.allowed) {
    await writeAuditLog({
      userId: auth.user.id,
      event: "ai_rate_limited",
      request,
      metadata: { bucket: "ai_chat" },
    });
    return jsonResponse({ error: "AI rate limit reached. Try again later." }, 429);
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 32768, maxKeys: 6 });
  if (!bodyResult.ok) return bodyResult.response;

  const { conversationId, courseId, message, mode, resourceId, useCourseContext } = bodyResult.body;

  const allowedModes = ["chat", "explain", "teach", "summarize", "quiz", "step-by-step", "exam", "flashcards"];
  if (mode !== undefined && (!allowedModes.includes(mode))) {
    return jsonResponse({ error: "Invalid study mode." }, 400);
  }
  const studyMode = mode || "chat";

  const messageResult = validateText(message, {
    name: "message",
    min: 1,
    max: 8000,
  });
  if (!messageResult.ok) {
    return jsonResponse({ error: messageResult.error }, 400);
  }

  if (conversationId !== undefined && conversationId !== null &&
      (typeof conversationId !== "string" || !/^[0-9a-f-]{36}$/i.test(conversationId))) {
    return jsonResponse({ error: "Invalid conversationId." }, 400);
  }

  if (resourceId !== undefined && resourceId !== null && (typeof resourceId !== "string" || !/^[0-9a-f-]{36}$/i.test(resourceId))) {\n    return jsonResponse({ error: "Invalid resourceId." }, 400);\n  }\n\n  if (useCourseContext !== undefined && typeof useCourseContext !== "boolean") {\n    return jsonResponse({ error: "Invalid useCourseContext." }, 400);\n  }\n\n  if (courseId !== undefined && courseId !== null &&
      (typeof courseId !== "string" || !/^[0-9a-f-]{36}$/i.test(courseId))) {
    return jsonResponse({ error: "Invalid courseId." }, 400);
  }

  const service = createServiceClient();

  let studySources = [];
  if (useCourseContext || resourceId) {
    let contextQuery = service.from("chapters")
      .select("id,course_id,title,resources!inner(id,title,description,type,url,status)")
      .eq("status", "published")
      .eq("resources.status", "published");
    if (courseId) contextQuery = contextQuery.eq("course_id", courseId);
    const { data: contextChapters, error: contextError } = await contextQuery;
    if (contextError) return jsonResponse({ error: "Could not load course context." }, 500);
    for (const chapter of contextChapters || []) {
      for (const resource of chapter.resources || []) {
        if (!resourceId || resource.id === resourceId) {
          studySources.push({
            id: resource.id,
            title: resource.title,
            description: resource.description,
            type: resource.type,
            url: resource.url,
            chapterTitle: chapter.title,
          });
        }
      }
    }
    if (resourceId && !studySources.length) return jsonResponse({ error: "Resource context is unavailable." }, 400);
    studySources = studySources.slice(0, 20);
  }

  if (courseId) {
    const { data: course, error: courseError } = await service
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();

    if (courseError || !course) {
      return jsonResponse({ error: "Course context is unavailable." }, 400);
    }
  }
  let conversation;

  if (conversationId) {
    const { data, error } = await service
      .from("ai_conversations")
      .select("id, user_id, course_id, title")
      .eq("id", conversationId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ error: "Conversation not found." }, 404);
    }

    conversation = data;
  } else {
    const { data, error } = await service
      .from("ai_conversations")
      .insert({
        user_id: auth.user.id,
        course_id: courseId || null,
        title: messageResult.value.slice(0, 80),
      })
      .select("id, user_id, course_id, title")
      .single();

    if (error || !data) {
      console.error("AI conversation creation failed:", error);
      return jsonResponse({ error: "Could not create AI conversation." }, 500);
    }

    conversation = data;
  }

  if (courseId && conversation.course_id && courseId !== conversation.course_id) {
    return jsonResponse({ error: "Conversation course does not match request." }, 400);
  }

  if (courseId && !conversation.course_id) {
    const { error } = await service
      .from("ai_conversations")
      .update({ course_id: courseId })
      .eq("id", conversation.id)
      .eq("user_id", auth.user.id);

    if (error) {
      return jsonResponse({ error: "Could not attach course to conversation." }, 500);
    }
  }

  const { data: history, error: historyError } = await service
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversation.id)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);

  if (historyError) {
    console.error("AI history read failed:", historyError);
    return jsonResponse({ error: "Could not load AI conversation." }, 500);
  }

  const modeInstructions = {
    chat: "Answer normally and help the student learn.",
    explain: "Explain the topic simply, then give an intuitive example and a short recap.",
    teach: "Teach step by step. Ask the student to think along when useful, and build from basics to the harder idea.",
    summarize: "Create a concise revision summary with key ideas, definitions, formulas, and common mistakes.",
    quiz: "Act as a tutor quizmaster. Ask one question at a time unless the student explicitly asks for a full quiz. Do not reveal the answer before the student attempts it.",
    "step-by-step": "Solve or explain the problem step by step. Show the reasoning and explain why each step is taken.",
    exam: "Use exam-focused teaching: prioritize important concepts, likely question patterns, formulas, marking-friendly steps, and quick revision.",
    flashcards: "Create study flashcards. Use exactly this format for each card: Q: question on one line, A: answer on the next line. Make 8-12 useful cards unless the student specifies another number. Do not add commentary before or after the cards.",
  };

  const userMessage = {
    role: "user",
    content: messageResult.value,
  };

  const messages = [
    {
      role: "system",
      content:
        "You are Study Hub Student AI, a helpful study assistant. " +
        "Explain concepts clearly, use examples when useful, and help students learn rather than simply giving answers. " +
        "Do not claim certainty when you are unsure. Keep responses focused and suitable for a student. " +
        "Current study mode: " + studyMode + ". " + modeInstructions[studyMode] +
        (studySources.length ? " Use the following Study Hub sources for course-specific claims. Cite them inline as [S1], [S2], etc. Never invent source IDs.\\n\\n" +
          studySources.map((source, index) =>
            "[S" + (index + 1) + "] " + source.title + " | Chapter: " + source.chapterTitle + " | Type: " + source.type + " | Description: " + (source.description || "")
          ).join("\\n") : ""),
    },
    ...(history || [])
      .reverse()
      .filter((item) => item.role === "user" || item.role === "assistant")
      .map((item) => ({ role: item.role, content: item.content })),
    userMessage,
  ];

  const { error: insertUserError } = await service
    .from("ai_messages")
    .insert({
      conversation_id: conversation.id,
      user_id: auth.user.id,
      role: "user",
      content: messageResult.value,
    });

  if (insertUserError) {
    console.error("AI user message insert failed:", insertUserError);
    return jsonResponse({ error: "Could not save your message." }, 500);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Student AI is not configured yet." }, 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://study-hub-in-vert.vercel.app",
        "X-Title": "Study Hub Student AI",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 1200,
        temperature: 0.4,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    let payload = null;
    try {
      payload = await upstream.json();
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      console.error("OpenRouter request failed:", {
        status: upstream.status,
        error: payload?.error?.code || payload?.error?.message || "unknown",
      });
      await writeAuditLog({
        userId: auth.user.id,
        event: "ai_upstream_error",
        request,
        metadata: { status: upstream.status },
      });
      return jsonResponse({ error: "Student AI could not answer right now." }, 502);
    }

    const assistantContent = payload?.choices?.[0]?.message?.content;
    const answerResult = validateText(assistantContent, {
      name: "assistant response",
      min: 1,
      max: 20000,
    });

    if (!answerResult.ok) {
      return jsonResponse({ error: "Student AI returned an invalid response." }, 502);
    }

    const { error: assistantInsertError } = await service
      .from("ai_messages")
      .insert({
        conversation_id: conversation.id,
        user_id: auth.user.id,
        role: "assistant",
        content: answerResult.value,
      });

    if (assistantInsertError) {
      console.error("AI assistant message insert failed:", assistantInsertError);
      return jsonResponse({ error: "AI answered, but the response could not be saved." }, 500);
    }

    await service
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .eq("user_id", auth.user.id);

    await writeAuditLog({
      userId: auth.user.id,
      event: "ai_chat_success",
      request,
      metadata: { conversation_id: conversation.id, model: MODEL, mode: studyMode },
    });

    return jsonResponse({
      conversationId: conversation.id,
      message: {
        role: "assistant",
        content: answerResult.value,
      },
    });
  } catch (error) {
    const aborted = error?.name === "AbortError";
    console.error("AI request failed:", error);

    await writeAuditLog({
      userId: auth.user.id,
      event: aborted ? "ai_timeout" : "ai_request_error",
      request,
      metadata: { conversation_id: conversation.id },
    });

    return jsonResponse(
      { error: aborted ? "Student AI timed out. Try again." : "Student AI is temporarily unavailable." },
      504
    );
  } finally {
    clearTimeout(timeout);
  }
}
