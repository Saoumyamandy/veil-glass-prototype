# Veil Glass prototype

A clickable prototype of a glass "veil" that sits on a coding agent and explains its work to a designer or PM, using explainable-AI ideas in plain language.

**Live:** https://saoumyamandy.github.io/veil-glass-prototype/

A simulated agent adds a pricing page to Lumen, a made-up app. Its raw terminal runs under the glass, and the page it is building updates live on the right. The veil's layers come from the Agent Veil playground, renamed for non-technical readers: what it's saying, thinking and doing, the raw work, who it asked for help, and how the page changed.

## What you can try

Use the bar at the top to switch versions, pause, skip ahead or restart.

- **Glass sheet.** A frosted sheet covers the terminal. The dial runs from Result to Everything, and the glass clears as it shows more. Hover a card and its raw lines glow underneath. The header buttons cover the work, pin the sheet to the left, or collapse it to a strip.
- **Lens.** The whole window is frosted. Drag the lens over the terminal to read the raw lines and see them in plain words. Drag it over the page to see which steps built each part. Scroll on it, or press + and −, to look deeper.

In both versions you can:

- Ask **Why?** on any step to see the thinking behind it.
- Say **Not that** to the agent's choice of switch, and watch it redo the work with your component.
- Answer the question it asks about the yearly saving.
- Open **Claims vs checks** to see each claim beside the check behind it and whether that check passed. A failed test cracks the glass. Its "looks right on mobile" claim was never checked: switch the preview to Phone, then ask it to check.
- Read the **Change log** of everything you revealed, asked or redirected.

## Running it locally

It is plain HTML, CSS and JavaScript modules, so it needs a static server rather than a `file://` URL:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. All data is made up.
