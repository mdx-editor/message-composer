import { PastedTextScenario } from "./pasted-text.fixtures.tsx";
export default { title: "Pasted text" };
export const Playground = () => <PastedTextScenario />;
export const WithPastedText = () => <PastedTextScenario populated />;
export const Controlled = () => <PastedTextScenario populated controlled />;
