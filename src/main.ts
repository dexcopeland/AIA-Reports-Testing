import "@fontsource/source-sans-pro/400.css";
import "@fontsource/source-sans-pro/600.css";
import "@fontsource/source-sans-pro/700.css";
import "./styles.css";
import { mount } from "./ui/app";

const root = document.querySelector("#main");
if (!root) throw new Error("Missing #main");
mount(root);
