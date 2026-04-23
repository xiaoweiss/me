import { createRoot } from "react-dom/client";
import { configureTokenKey } from "@/api/client";

// H5 端 token 命名空间（与 admin.tsx 的 admin_token 隔离）
configureTokenKey("auth_token");

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
