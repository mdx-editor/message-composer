import { MessageComposer } from "./MessageComposer.tsx";

export default {
  title: "MessageComposer",
};

export const Placeholder = () => (
  <MessageComposer
    aria-label="Message"
    defaultValue="This is a placeholder textarea for the future composer."
    placeholder="Write a message..."
    rows={5}
  />
);
