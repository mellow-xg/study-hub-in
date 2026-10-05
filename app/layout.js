import "./globals.css";
import StudyHubGestures from "../components/StudyHubGestures";
import SessionGuard from "../components/SessionGuard";

export const metadata = {
  title: "Study Hub",
  description: "Video lectures and notes, all in one place"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              const theme = localStorage.getItem("theme");
              if (theme === "dark") document.documentElement.classList.add("dark");
            } catch (e) {}`
          }}
        />
      </head>
      <body>
        <SessionGuard>
          <StudyHubGestures>{children}</StudyHubGestures>
        </SessionGuard>
      </body>
    </html>
  );
}