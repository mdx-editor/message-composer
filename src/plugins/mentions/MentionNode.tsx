import { Cell } from "@virtuoso.dev/reactive-engine-core";
import { useCellValue } from "@virtuoso.dev/reactive-engine-react";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { ComponentType, JSX } from "react";

export interface MessageComposerMentionTokenProps {
  id: string;
  trigger: string;
  label: string;
  data?: unknown;
}

/**
 * Token renderer configured through the mentions plugin; null renders the
 * unstyled default. Decorators are portaled from inside the composer tree, so
 * the slot component can read this cell through the engine context.
 */
export const mentionTokenComponent$ = Cell<ComponentType<MessageComposerMentionTokenProps> | null>(null);

export type SerializedMentionNode = Spread<
  {
    mentionId: string;
    trigger: string;
    label: string;
    data?: unknown;
  },
  SerializedLexicalNode
>;

function DefaultMentionToken({ trigger, label }: MessageComposerMentionTokenProps) {
  return <span className="message-composer-mention-token">{trigger + label}</span>;
}

function MentionTokenSlot(props: MessageComposerMentionTokenProps) {
  const Token = useCellValue(mentionTokenComponent$) ?? DefaultMentionToken;
  return <Token {...props} />;
}

export class MentionNode extends DecoratorNode<JSX.Element> {
  __mentionId: string;
  __trigger: string;
  __label: string;
  __data: unknown;

  static getType(): string {
    return "message-composer-mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mentionId, node.__trigger, node.__label, node.__data, node.__key);
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    return $createMentionNode({
      id: serializedNode.mentionId,
      trigger: serializedNode.trigger,
      label: serializedNode.label,
      data: serializedNode.data,
    });
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-mention-id")) {
          return null;
        }
        return {
          conversion: (element: HTMLElement): DOMConversionOutput => ({
            node: $createMentionNode({
              id: element.getAttribute("data-lexical-mention-id") ?? "",
              trigger: element.getAttribute("data-lexical-mention-trigger") ?? "@",
              label: element.getAttribute("data-lexical-mention-label") ?? "",
            }),
          }),
          priority: 1,
        };
      },
    };
  }

  constructor(mentionId: string, trigger: string, label: string, data?: unknown, key?: NodeKey) {
    super(key);
    this.__mentionId = mentionId;
    this.__trigger = trigger;
    this.__label = label;
    this.__data = data;
  }

  exportJSON(): SerializedMentionNode {
    const json: SerializedMentionNode = {
      ...super.exportJSON(),
      mentionId: this.getMentionId(),
      trigger: this.getTrigger(),
      label: this.getLabel(),
    };
    const data = this.getData();
    if (data !== undefined) {
      json.data = data;
    }
    return json;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-mention-id", this.getMentionId());
    element.setAttribute("data-lexical-mention-trigger", this.getTrigger());
    element.setAttribute("data-lexical-mention-label", this.getLabel());
    element.textContent = this.getTextContent();
    return { element };
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "message-composer-mention";
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  getMentionId(): string {
    return this.getLatest().__mentionId;
  }

  getTrigger(): string {
    return this.getLatest().__trigger;
  }

  getLabel(): string {
    return this.getLatest().__label;
  }

  getData(): unknown {
    return this.getLatest().__data;
  }

  getTextContent(): string {
    return this.getTrigger() + this.getLabel();
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  decorate(): JSX.Element {
    return (
      <MentionTokenSlot
        id={this.getMentionId()}
        trigger={this.getTrigger()}
        label={this.getLabel()}
        data={this.getData()}
      />
    );
  }
}

export function $createMentionNode(mention: {
  id: string;
  trigger: string;
  label: string;
  data?: unknown;
}): MentionNode {
  return $applyNodeReplacement(new MentionNode(mention.id, mention.trigger, mention.label, mention.data));
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}
