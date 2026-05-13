import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useEffect, useState } from "react";
import { sanitizeHTML } from "../utils/sanitize";

const lowlight = createLowlight(common);

// Link validation: only https:// is accepted. http:// and javascript: are
// rejected. mailto: and in-page anchors are not exposed in the toolbar.
function isValidLinkHref(href) {
  if (typeof href !== "string") return false;
  return /^https:\/\//i.test(href.trim());
}

function isValidImageSrc(src) {
  if (typeof src !== "string") return false;
  const trimmed = src.trim();
  return (
    /^https:\/\//i.test(trimmed) ||
    /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed)
  );
}

const SafeLink = Link.extend({
  // Reject any link insertion that doesn't pass the https:// check.
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
      validate: (href) => isValidLinkHref(href),
    };
  },
});

const SafeImage = Image.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: true,
      HTMLAttributes: {
        loading: "lazy",
        referrerpolicy: "no-referrer",
      },
    };
  },
  // Override the insert command to validate src before it touches the doc.
  addCommands() {
    const parent = this.parent?.();
    return {
      ...parent,
      setImage:
        (options) =>
        ({ commands }) => {
          if (!isValidImageSrc(options?.src)) return false;
          return parent.setImage(options)({ commands });
        },
    };
  },
});

// ── Toolbar ──────────────────────────────────────────────────────────────

function btnStyle(active) {
  return {
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--accent-ink)" : "var(--text)",
    border: "1px solid var(--border)",
    padding: "4px 8px",
    minWidth: 32,
    height: 32,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={btnStyle(active)}
      onMouseEnter={(e) => {
        if (!active && !disabled) e.currentTarget.style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {children}
    </button>
  );
}

function Separator() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        alignSelf: "stretch",
        background: "var(--border)",
        margin: "0 4px",
      }}
    />
  );
}

function Toolbar({ editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  if (!editor) return null;

  const applyLink = () => {
    setLinkError("");
    if (!isValidLinkHref(linkUrl)) {
      setLinkError("Only https:// URLs are accepted.");
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: linkUrl.trim(), target: "_blank", rel: "noopener noreferrer" })
      .run();
    setLinkUrl("");
    setLinkOpen(false);
  };

  const applyImage = () => {
    setImageError("");
    if (!isValidImageSrc(imageUrl)) {
      setImageError("Only https:// or data:image/<type>;base64 URLs are accepted.");
      return;
    }
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl("");
    setImageOpen(false);
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: 8,
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        alignItems: "center",
      }}
    >
      {/* Text style group */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Underline"
      >
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive("highlight")}
        title="Highlight"
      >
        ▮
      </ToolbarButton>

      <Separator />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive("paragraph")}
        title="Paragraph"
      >
        P
      </ToolbarButton>

      <Separator />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet list"
      >
        •≡
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered list"
      >
        1.
      </ToolbarButton>

      <Separator />

      {/* Blocks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        ❝
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code block"
      >
        {"</>"}
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        active={false}
        title="Horizontal rule"
      >
        ―
      </ToolbarButton>

      <Separator />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Align left"
      >
        ⯇
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Align center"
      >
        ⯈⯇
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Align right"
      >
        ⯈
      </ToolbarButton>

      <Separator />

      {/* Insert */}
      <div style={{ position: "relative" }}>
        <ToolbarButton
          onClick={() => { setLinkOpen((o) => !o); setImageOpen(false); }}
          active={editor.isActive("link") || linkOpen}
          title="Insert link"
        >
          🔗
        </ToolbarButton>
        {linkOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 30,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: 8,
              width: 320,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <input
              type="url"
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="input"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); applyLink(); }
                if (e.key === "Escape") setLinkOpen(false);
              }}
            />
            {linkError && (
              <p className="font-mono text-xs" style={{ color: "var(--danger)" }}>{linkError}</p>
            )}
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {editor.isActive("link") && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                >
                  Remove
                </button>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setLinkOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={applyLink}>
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <ToolbarButton
          onClick={() => { setImageOpen((o) => !o); setLinkOpen(false); }}
          active={imageOpen}
          title="Insert image"
        >
          🖼
        </ToolbarButton>
        {imageOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 30,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: 8,
              width: 360,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <input
              type="url"
              autoFocus
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... or data:image/png;base64,..."
              className="input"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); applyImage(); }
                if (e.key === "Escape") setImageOpen(false);
              }}
            />
            {imageError && (
              <p className="font-mono text-xs" style={{ color: "var(--danger)" }}>{imageError}</p>
            )}
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setImageOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={applyImage}>
                Insert
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────

export function Editor({ content = "", onChange, placeholder = "Write…", readOnly = false }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by code-block-lowlight below
      }),
      CodeBlockLowlight.configure({ lowlight }),
      SafeLink,
      SafeImage,
      Underline,
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Typography,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable: !readOnly,
    onUpdate({ editor }) {
      if (!onChange) return;
      const dirty = editor.getHTML();
      // Sanitize before exposing to the parent. The parent NEVER sees raw
      // editor output — defense-in-depth.
      onChange(sanitizeHTML(dirty));
    },
  });

  // Keep editor in sync when readOnly toggles
  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable === readOnly) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Keep editor content in sync if the parent swaps it (e.g. loading a draft).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content && content !== current) {
      // Only update on substantive external change to avoid cursor jumps.
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {!readOnly && <Toolbar editor={editor} />}
      <div
        style={{
          padding: 16,
          minHeight: readOnly ? 0 : 200,
          background: "var(--bg)",
          color: "var(--text)",
        }}
        className="prose tiptap-editor-host"
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
