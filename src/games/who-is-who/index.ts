/**
 * Точка входа модуля игры «Кто тут кто?».
 * Для интеграции достаточно импортировать default-компонент:
 *   import WhoIsWhoGame from "@/features/who-is-who";
 */
export { default } from "./WhoIsWhoGame";
export { default as WhoIsWhoGame } from "./WhoIsWhoGame";
export { SITUATIONS } from "./whoIsWhoData";
export type {
  Player,
  Situation,
  Screen,
  Assignments,
} from "./whoIsWhoTypes";
