"use strict";
const $ = (q) => document.querySelector(q),
  content = $("#content"),
  statusText = $("#status");
const pages = [
  "Overview",
  "Welcome configuration",
  "Welcome embed editor",
  "GIF banner manager",
  "Rules management",
  "Auto role configuration",
  "Logging configuration",
  "Live logs viewer",
  "Moderation settings",
  "Security settings",
  "Music configuration",
  "Bot status",
  "Database / backup",
  "Owner settings",
];
let state,
  page = pages[0],
  offset = 0;
function el(tag, text, parent = content) {
  const n = document.createElement(tag);
  n.textContent = text ?? "";
  parent.append(n);
  return n;
}
function act(label, fn, parent = content) {
  const b = el("button", label, parent);
  b.onclick = async () => {
    b.disabled = true;
    try {
      await fn();
    } catch (e) {
      statusText.textContent = e.message;
    } finally {
      b.disabled = false;
    }
  };
  return b;
}
const gid = () => $("#guild").value;
async function api(route, body, params = {}) {
  if (body !== undefined) throw Error("Live controls are unavailable in this preview.");
  if (route === "/guilds") return [{ id: "preview", name: "JJK CORE Demo" }];
  if (route === "/state") return {
    name: "JJK CORE Demo", displayName: "JJK CORE Demo", count: 42, ping: 32,
    uptime: 3600000, music: 1, roles: [], channels: [["42", "welcome"]],
    config: {}, owner: true, metrics: {}, events: [],
  };
  if (route === "/logs") return [];
  throw Error("This action requires the live dashboard.");
}
function control(label, type, value, choices, parent = content) {
  const l = el("label", label, parent),
    n = el(
      type === "list" ? "select" : type === "area" ? "textarea" : "input",
      "",
      l,
    );
  if (type === "list")
    for (const [v, t] of [["", "Select…"], ...choices]) {
      const option = el("option", t, n);
      option.value = v;
    }
  if (n.tagName === "INPUT") n.type = type;
  if (type === "checkbox") n.checked = !!value;
  else if (type !== "file") n.value = value ?? "";
  return n;
}
async function save(body) {
  await api("/save", body);
  state = await api("/state");
  statusText.textContent = "Changes saved.";
}
function form(defs, extra = {}) {
  const read = {};
  for (const [k, label, type = "text", options] of defs) {
    const n = control(
      label,
      type,
      state.config[k] ?? (k === "welcomeEnabled" ? true : undefined),
      options,
    );
    read[k] = () =>
      type === "checkbox"
        ? n.checked
        : type === "number"
          ? Number(n.value)
          : n.value;
  }
  act("Save changes", () =>
    save({
      ...Object.fromEntries(Object.entries(read).map(([k, fn]) => [k, fn()])),
      ...extra,
    }),
  );
}
function preview(c) {
  const a = el("article");
  a.style.borderLeft = "4px solid #" + (c.color || "9364df");
  function fill(s) {
    return (s || "")
      .replaceAll("{server}", state.name)
      .replaceAll("{count}", String(state.count))
      .replace(/\{(?:user|mention)\}/g, "Example member");
  }
  el("h2", fill(c.title) || "Welcome to " + state.name, a);
  el("p", fill(c.description) || "Welcome Example member!", a);
  if (c.thumbnail) {
    const im = el("img", "", a);
    im.width = 56;
    im.src = c.thumbnail;
  }
  for (const f of c.fields || []) {
    el("b", fill(f.name), a);
    el("p", fill(f.value), a);
  }
  if (c.banner || c.upload) {
    const im = el("img", "", a);
    im.src =
      c.banner ||
      "data:image/" +
        c.upload.name.split(".").pop() +
        ";base64," +
        c.upload.data;
  }
  el("footer", fill(c.footer) || state.count + " members", a);
  return a;
}
async function show() {
  content.replaceChildren();
  statusText.textContent = "";
  $("#title").textContent = page === "Overview" ? state.displayName : page;
  for (const b of document.querySelectorAll("nav button"))
    b.classList.toggle("active", b.textContent === page);
  const c = state.config,
    ch = state.channels;
  if (page === "Overview" || page === "Bot status") {
    const box = el("div");
    box.className = "cards";
    for (const [title, value] of [
      ["Members", state.count],
      ["Gateway ping", state.ping + " ms"],
      ["Uptime", Math.floor(state.uptime / 60000) + " min"],
      ["Music nodes", state.music],
      ["Messages", state.metrics.totalMessages || 0],
    ])
      el("b", value, el("article", title, box));
    return;
  }
  if (page === "Welcome configuration") {
    form([
      ["customWelcome", "Use custom welcome and leave messages", "checkbox"],
      ["welcomeEnabled", "Send custom messages", "checkbox"],
      ["welcomeChannelId", "Welcome channel", "list", ch],
      ["goodbyeChannelId", "Leave channel", "list", ch],
      ["leaveTitle", "Leave title"],
      ["leave", "Leave message", "area"],
    ]);
    return;
  }
  if (page === "Welcome embed editor") {
    const draft = { ...c };
    el("p", "Placeholders: {user}, {mention}, {server}, {count}.");
    let box;
    const refresh = () => {
      box?.remove();
      box = preview(draft);
    };
    for (const [k, t] of [
      ["title", "Title"],
      ["description", "Description"],
      ["footer", "Footer"],
      ["color", "Color (hex)"],
      ["thumbnail", "Thumbnail URL"],
      ["banner", "GIF or image URL"],
    ]) {
      const n = control(t, k === "description" ? "area" : "text", draft[k]);
      n.oninput = () => {
        draft[k] = n.value;
        refresh();
      };
    }
    const fields = control(
      "Fields (one name | value per line)",
      "area",
      (c.fields || []).map((f) => f.name + " | " + f.value).join("\n"),
    );
    fields.oninput = () => {
      draft.fields = fields.value
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          const [name, ...v] = l.split("|");
          return { name: name.trim(), value: v.join("|").trim() };
        });
      refresh();
    };
    const persist = () =>
      save(
        Object.fromEntries(
          [
            "title",
            "description",
            "footer",
            "color",
            "thumbnail",
            "banner",
            "fields",
          ]
            .filter((k) => draft[k] !== undefined)
            .map((k) => [k, draft[k]]),
        ),
      );
    act("Save embed", persist);
    const dest = control("Test channel", "list", c.welcomeChannelId, ch);
    act("Save and send test", async () => {
      if (!dest.value) throw Error("Choose a channel");
      await persist();
      await api("/test", { channel: dest.value });
      statusText.textContent = "Test sent.";
    });
    refresh();
    return;
  }
  if (page === "GIF banner manager") {
    form([["banner", "GIF or image URL"]]);
    const f = control("Upload GIF, JPEG or PNG (up to 4 MB)", "file");
    f.accept = "image/gif,image/png,image/jpeg";
    act("Upload banner", async () => {
      const file = f.files[0];
      if (!file || file.size > 4000000)
        throw Error("Choose an image under 4 MB");
      const data = await new Promise((ok, no) => {
        const reader = new FileReader();
        reader.onload = () => ok(reader.result);
        reader.onerror = no;
        reader.readAsDataURL(file);
      });
      await api("/upload", { image: data.split(",")[1] });
      state = await api("/state");
      await show();
      statusText.textContent = "Banner uploaded.";
    });
    preview(c);
    return;
  }
  if (page === "Rules management") {
    const title = control("Embed title", "text", c.rulesTitle),
      desc = control("Description", "area", c.rulesDescription),
      channel = control("Rules channel", "list", c.rulesChannel, ch);
    const groups = el("div"),
      list = [];
    function section(s) {
      const box = el("article", "", groups),
        name = control("Section name", "text", s.name, null, box),
        rules = control(
          "Rules (one per line; emojis supported)",
          "area",
          s.rules.join("\n"),
          null,
          box,
        );
      const item = { box, name, rules };
      list.push(item);
      act(
        "Remove section",
        () => {
          box.remove();
          list.splice(list.indexOf(item), 1);
        },
        box,
      );
    }
    (c.sections || []).forEach(section);
    act("Add section", () => section({ name: "", rules: [] }));
    const persist = () =>
      save({
        rulesTitle: title.value,
        rulesDescription: desc.value,
        rulesChannel: channel.value,
        sections: list.map((s) => ({
          name: s.name.value,
          rules: s.rules.value.split("\n").filter(Boolean),
        })),
      });
    act("Save rules", persist);
    act("Publish rules update", async () => {
      await persist();
      await api("/publish", {});
      statusText.textContent = "Rules published.";
    });
    return;
  }
  if (page === "Auto role configuration")
    return form([
      ["memberRole", "Role after accepting rules", "list", state.roles],
    ]);
  if (page === "Logging configuration") {
    const channels = {},
      disabled = [];
    const color = control("Log color (hex)", "text", c.logColor || "9767dd"),
      days = control("Retention in days", "number", c.retention || 30);
    for (const [cat, items] of Object.entries(state.events)) {
      const d = el("details");
      el("summary", cat, d);
      channels[cat] = control(
        "Discord channel",
        "list",
        c.channels?.[cat],
        ch,
        d,
      );
      for (const event of items)
        disabled.push([
          event,
          control(event, "checkbox", !c.disabled?.includes(event), null, d),
        ]);
    }
    act("Save logging", () =>
      save({
        channels: Object.fromEntries(
          Object.entries(channels).map(([k, n]) => [k, n.value]),
        ),
        disabled: disabled.filter(([, n]) => !n.checked).map(([k]) => k),
        retention: Number(days.value),
        logColor: color.value,
      }),
    );
    return;
  }
  if (page === "Live logs viewer") {
    const q = control("Username, ID or text", "search"),
      cat = control(
        "Category",
        "list",
        "",
        Object.keys(state.events).map((k) => [k, k]),
      ),
      from = control("From", "date"),
      to = control("Through", "date");
    const params = () => ({
      q: q.value,
      category: cat.value,
      from: from.value,
      to: to.value,
      page: String(offset),
    });
    async function refresh() {
      const rows = await api("/logs", undefined, params());
      if (!list.isConnected) return;
      list.replaceChildren();
      for (const r of rows) {
        const d = el("details", "", list);
        el("summary", new Date(r.at).toLocaleString() + " · " + r.event, d);
        el("pre", JSON.stringify(r, null, 2), d);
      }
      if (!rows.length) el("p", "No matching events.", list);
    }
    act("Filter", () => {
      offset = 0;
      return refresh();
    });
    act("Previous", () => {
      offset = Math.max(0, offset - 1);
      return refresh();
    });
    act("Next", () => {
      offset++;
      return refresh();
    });
    act("Export CSV", () =>
      location.assign(
        "/export?" +
          new URLSearchParams({ ...params(), page: "0", guild: gid() }),
      ),
    );
    const list = el("div");
    list.refresh = refresh;
    list.id = "timeline";
    await refresh();
    return;
  }
  if (page === "Moderation settings")
    return form([
      ["automodEnabled", "Enable existing auto-moderation", "checkbox"],
    ]);
  if (page === "Security settings")
    return form([
      ["antiRaidEnabled", "Enable anti-raid", "checkbox"],
      ["antiNukeEnabled", "Enable anti-nuke", "checkbox"],
    ]);
  if (page === "Music configuration") {
    const volume = control("Current queue volume (%)", "number", 100);
    act("Apply volume", async () => {
      await api("/volume", { volume: Number(volume.value) });
      statusText.textContent = "Queue volume updated.";
    });
    return;
  }
  if (page === "Database / backup") {
    el(
      "p",
      "Download a backup of this server’s dashboard settings. The host also backs up the database daily.",
    );
    act("Download configuration", () => {
      const b = new Blob([JSON.stringify(c, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(b),
        a = el("a");
      a.href = url;
      a.download = "jjk-" + gid() + ".json";
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return;
  }
  if (page === "Owner settings") {
    if (!state.owner) {
      el("p", "Only the server owner can edit this page.");
      return;
    }
    const setting = control(
      "Server dashboard display name",
      "text",
      c.displayName || state.name,
    );
    act("Save display name", async () => {
      await api("/owner", { displayName: setting.value });
      state = await api("/state");
      statusText.textContent = "Owner settings saved.";
    });
  }
}
async function start() {
  let guilds;
  try {
    guilds = await api("/guilds");
  } catch (e) {
    statusText.textContent = e.message;
    return;
  }
  $("#logout").hidden = false;
  $("#logout").onclick = async () => {
    await api("/logout", {});
    location.reload();
  };
  if (!guilds.length) {
    content.textContent = "No administered servers are available.";
    return;
  }
  for (const g of guilds) {
    const o = el("option", g.name, $("#guild"));
    o.value = g.id;
  }
  for (const p of pages)
    act(
      p,
      () => {
        page = p;
        offset = 0;
        return show();
      },
      $("nav"),
    );
  async function load() {
    state = await api("/state");
    await show();
  }
  $("#guild").onchange = load;
  await load();
  setInterval(async () => {
    try {
      if (page === "Live logs viewer") await $("#timeline")?.refresh();
      if (["Overview", "Bot status"].includes(page)) {
        state = await api("/state");
        await show();
      }
    } catch (e) {
      statusText.textContent = e.message;
    }
  }, 10000);
}
start().catch((e) => (statusText.textContent = e.message));
