"use client";
import { createContext, useContext } from "react";
/** Lets a form inside a popup close it once it has done its job (and tell it apart from the same form on a full page). */
export const ModalCloseContext = createContext<(() => void) | null>(null);
export const useModalClose = () => useContext(ModalCloseContext);
