import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
export type Theme="light"|"dark"|"system";
type ThemeValue={theme:Theme;setTheme:(theme:Theme)=>void};
const Context=createContext<ThemeValue|null>(null);
const KEY="daymark-theme";
function apply(theme:Theme){const dark=theme==="dark"||(theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=dark?"dark":"light";document.documentElement.style.colorScheme=dark?"dark":"light";}
export function ThemeProvider({children}:{children:ReactNode}){const [theme,setValue]=useState<Theme>(()=>{const saved=localStorage.getItem(KEY);return saved==="light"||saved==="dark"||saved==="system"?saved:"system";});const setTheme=(next:Theme)=>{setValue(next);localStorage.setItem(KEY,next);apply(next);};useEffect(()=>{apply(theme);const media=window.matchMedia("(prefers-color-scheme: dark)");const listener=()=>{if(theme==="system")apply("system");};media.addEventListener("change",listener);return()=>media.removeEventListener("change",listener);},[theme]);const value=useMemo(()=>({theme,setTheme}),[theme]);return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useTheme(){const value=useContext(Context);if(!value)throw new Error("useTheme must be used within ThemeProvider");return value;}
