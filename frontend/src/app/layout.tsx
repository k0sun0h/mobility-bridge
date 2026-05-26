// src/app/layout.tsx

import "../styles/index.css"; 
export const metadata = {
  title: "Mobility Bridge",
  description: "교통약자를 위한 내비게이션",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {}
      </head>
      <body>
        {}
        {children}
      </body>
    </html>
  );
}