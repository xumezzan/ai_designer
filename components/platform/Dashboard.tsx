"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  InvitationDraft,
  InvitationRecord,
  InvitationSummary,
  PlatformUser,
  RsvpRecord,
} from "@/lib/platform/schema";
import { createEmptyDraft } from "@/lib/platform/schema";
import { platformRequest } from "@/lib/platform/client";
import { csvCell } from "@/lib/platform-render/csv";
import {
  platformCopy,
  platformTemplates,
  type PlatformLocale,
} from "@/lib/platform/i18n";
import { Icon, BotanicalSprig } from "./Icon";
import { Miniature } from "./Miniature";
import { Modal } from "./Modal";
import { InvitationEditor } from "./InvitationEditor";
import { AiBriefWizard } from "./AiBriefWizard";
import "@/app/platform.css";

type View = "overview" | "invitations" | "designs" | "guests" | "settings";
type TemplateId = InvitationDraft["templateId"];

export function Dashboard() {
  const [locale, setLocale] = useState<PlatformLocale>("ru");
  const t = platformCopy[locale];
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("overview");
  const [items, setItems] = useState<InvitationSummary[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [auth, setAuth] = useState<"login" | "register" | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<TemplateId | null>(
    null,
  );
  const [pendingAi, setPendingAi] = useState(false);
  const [aiWizard, setAiWizard] = useState(false);
  const [editor, setEditor] = useState<InvitationRecord | null>(null);
  const [previousDraft, setPreviousDraft] = useState<InvitationDraft | undefined>();
  const [preview, setPreview] = useState<TemplateId | null>(null);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const result = await platformRequest<{ invitations: InvitationSummary[] }>(
      "/invitations",
    );
    setItems(result.invitations);
  }
  useEffect(() => {
    try {
      if (localStorage.getItem("taklif-locale") === "uz-latn")
        setLocale("uz-latn");
    } catch {
      /* The app also works when browser storage is disabled. */
    }
    platformRequest<{ user: PlatformUser | null }>("/auth/me")
      .then(async (result) => {
        setUser(result.user);
        if (result.user) await refresh();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function changeLocale(value: PlatformLocale) {
    setLocale(value);
    try {
      localStorage.setItem("taklif-locale", value);
    } catch {
      /* Keep the language in memory. */
    }
  }
  async function create(template: TemplateId) {
    if (!user) {
      setPendingAi(false);
      setPendingTemplate(template);
      setAuth("register");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const draft = createEmptyDraft(template);
      draft.locale = locale;
      if (draft.templateId === "corporate") draft.eventType = "corporate";
      if (draft.templateId === "modern") draft.eventType = "birthday";
      const result = await platformRequest<{ invitation: InvitationRecord }>(
        "/invitations",
        { method: "POST", body: JSON.stringify({ draft }) },
      );
      setPreviousDraft(undefined);
      setEditor(result.invitation);
      setPreview(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function createWithAi() {
    setPendingTemplate(null);
    setPreview(null);
    if (!user) {
      setPendingAi(true);
      setAuth("register");
      return;
    }
    setAiWizard(true);
  }
  async function openEditor(id: string) {
    setBusy(true);
    setError("");
    try {
      const result = await platformRequest<{ invitation: InvitationRecord }>(
        `/invitations/${id}`,
      );
      setPreviousDraft(undefined);
      setEditor(result.invitation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function authenticated(nextUser: PlatformUser) {
    setUser(nextUser);
    setAuth(null);
    setError("");
    await refresh();
    if (pendingAi) {
      setPendingAi(false);
      setAiWizard(true);
      return;
    }
    if (pendingTemplate) {
      const draft = createEmptyDraft(pendingTemplate);
      draft.locale = locale;
      if (draft.templateId === "corporate") draft.eventType = "corporate";
      if (draft.templateId === "modern") draft.eventType = "birthday";
      setBusy(true);
      try {
        const result = await platformRequest<{ invitation: InvitationRecord }>(
          "/invitations",
          { method: "POST", body: JSON.stringify({ draft }) },
        );
        setPreviousDraft(undefined);
        setEditor(result.invitation);
        setPreview(null);
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
        setPendingTemplate(null);
      }
    }
  }
  async function logout() {
    try {
      await platformRequest("/auth/logout", { method: "POST" });
      setUser(null);
      setAiWizard(false);
      setPendingAi(false);
      setItems([]);
      setView("overview");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const visible = items.filter(
    (item) =>
      (filter === "all" || item.status === filter) &&
      `${item.title} ${item.names.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const stats = [
    {
      label: t.active,
      value: items.filter((x) => x.status !== "archived").length,
      icon: "mail",
      note: "01",
    },
    {
      label: t.published,
      value: items.filter((x) => x.status === "published").length,
      icon: "external",
      note: "02",
    },
    {
      label: t.responses,
      value: items.reduce((sum, item) => sum + item.responseCount, 0),
      icon: "users",
      note: "03",
    },
    {
      label: t.drafts,
      value: items.filter((x) => x.status === "draft").length,
      icon: "clock",
      note: "04",
    },
  ];
  const nav = [
    { id: "overview", icon: "grid" },
    { id: "invitations", icon: "mail" },
    { id: "designs", icon: "flower" },
    { id: "guests", icon: "users" },
  ] as const;

  return (
    <div className="pf-app" lang={locale === "ru" ? "ru" : "uz-Latn"}>
      <aside className="pf-sidebar">
        <Link href="/" className="pf-brand" aria-label="Taklif — главная">
          <span className="pf-brand-mark">
            <Icon name="flower" size={30} />
          </span>
          taklif<span className="pf-brand-dot">.</span>
        </Link>
        <p className="pf-sidebar-label">{t.workspace}</p>
        <nav className="pf-nav" aria-label={t.dashboard}>
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{t[item.id]}</span>
              {item.id === "invitations" && items.length > 0 && (
                <span className="pf-nav-count">{items.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="pf-sidebar-bottom">
          <div className="pf-sidebar-note">
            <Icon name="heart" size={25} />
            <p>{t.handmade}</p>
            <small>{t.madeIn}</small>
          </div>
          <button onClick={() => setHelp(true)}>
            <Icon name="help" />
            <span>{t.help}</span>
          </button>
          <button
            onClick={() => setView("settings")}
            aria-current={view === "settings" ? "page" : undefined}
          >
            <Icon name="settings" />
            <span>{t.settings}</span>
          </button>
          <div className="pf-sidebar-foot">
            taklif studio <span>© 2026</span>
          </div>
        </div>
      </aside>
      <div className="pf-main-wrap">
        <header className="pf-topbar">
          <div className="pf-breadcrumb">
            {t.dashboard}
            <Icon name="chevron" size={12} />
            <span>{t[view]}</span>
          </div>
          <div className="pf-top-actions">
            <select
              aria-label="Язык интерфейса / Interfeys tili"
              value={locale}
              onChange={(e) => changeLocale(e.target.value as PlatformLocale)}
            >
              <option value="ru">RU</option>
              <option value="uz-latn">UZ</option>
            </select>
            <span className="pf-top-divider" />
            {user ? (
              <button className="pf-user" onClick={() => setView("settings")}>
                <span className="pf-avatar">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span>{user.name}</span>
              </button>
            ) : (
              <button
                className="pf-text-button"
                onClick={() => setAuth("login")}
              >
                {t.login}
                <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
        </header>
        <main className="pf-main" aria-busy={busy || loading}>
          {error && (
            <div className="pf-alert" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label={t.close}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <div className="pf-page-heading">
            <div>
              <span className="pf-eyebrow">THE ART OF COMING TOGETHER</span>
              <h1>{view === "overview" ? t.welcome : t[view]}</h1>
              <p>
                {view === "overview"
                  ? t.subtitle
                  : view === "designs"
                    ? t.collectionNote
                    : view === "guests"
                      ? t.guestsNote
                      : view === "settings"
                        ? t.accountText
                        : t.yoursNote}
              </p>
            </div>
            {view !== "settings" && (
              <div className="pf-ai-actions">
                <button className="pf-button pf-button-outline" disabled={busy || loading} onClick={() => create("classic")}>
                  <Icon name="plus" size={17} />{t.manualCreate}
                </button>
                <button className="pf-button pf-button-dark" disabled={busy || loading} onClick={createWithAi}>
                  <Icon name="flower" size={17} />{t.createWithAi}
                </button>
              </div>
            )}
          </div>
          {view === "overview" && (
            <>
              <section className="pf-hero">
                <div className="pf-hero-copy">
                  <span className="pf-hero-kicker">
                    <span />
                    {t.heroTag}
                  </span>
                  <h2>
                    {t.heroTitle}
                    <br />
                    <em>{t.heroItalic}</em>
                  </h2>
                  <p>{t.heroText}</p>
                  <button
                    className="pf-button pf-button-cream"
                    onClick={() => setView("designs")}
                  >
                    {t.heroButton}
                    <Icon name="arrow" size={17} />
                  </button>
                  <small>
                    <Icon name="clock" size={13} />
                    {t.minutes}
                  </small>
                </div>
                <div className="pf-hero-art" aria-hidden="true">
                  <div className="pf-hero-circle" />
                  <div className="pf-envelope" />
                  <div className="pf-hero-card">
                    <Miniature template="classic" />
                  </div>
                  <BotanicalSprig className="pf-hero-sprig" />
                  <span className="pf-hero-art-caption">
                    A LITTLE INVITATION.
                    <br />A LIFETIME OF MEMORIES.
                  </span>
                  <span className="pf-hero-seal">t.</span>
                </div>
              </section>
              <section className="pf-stats" aria-label={t.dashboard}>
                {stats.map((stat) => (
                  <div className="pf-stat" key={stat.label}>
                    <span className="pf-stat-icon">
                      <Icon name={stat.icon} />
                    </span>
                    <div>
                      <span>{stat.label}</span>
                      <strong>
                        {loading ? "—" : String(stat.value).padStart(2, "0")}
                      </strong>
                    </div>
                    <span className="pf-stat-number">{stat.note}</span>
                  </div>
                ))}
              </section>
            </>
          )}
          {(view === "overview" || view === "designs") && (
            <section className="pf-collection">
              <div className="pf-section-heading">
                <div>
                  <span className="pf-eyebrow">{t.collectionIndex}</span>
                  <h2>{t.collection}</h2>
                  <p>{t.collectionNote}</p>
                </div>
                {view === "overview" && (
                  <button
                    className="pf-link"
                    onClick={() => setView("designs")}
                  >
                    {t.allDesigns}
                    <Icon name="arrow" size={16} />
                  </button>
                )}
              </div>
              <div className="pf-design-grid">
                {platformTemplates.map((template) => (
                  <article className="pf-design" key={template.id}>
                    <button
                      className={`pf-design-art pf-design-art-${template.id}`}
                      onClick={() => setPreview(template.id)}
                      aria-label={`${t.preview} ${template.name}`}
                    >
                      <div className="pf-design-card">
                        <Miniature
                          template={template.id}
                          names={
                            template.id === "botanical"
                              ? ["Сардор", "Нилуфар"]
                              : template.id === "nocturne"
                                ? ["Тимур", "Сабина"]
                                : template.id === "heritage"
                                  ? ["Алишер", "Шахноза"]
                                  : template.id === "modern"
                                    ? [locale === "ru" ? "Алина" : "Alina"]
                                    : template.id === "corporate"
                                      ? ["NEXT / 2027"]
                                      : undefined
                          }
                        />
                      </div>
                      {template.id === "botanical" && (
                        <span className="pf-design-badge">{t.recommended}</span>
                      )}
                      <span className="pf-design-preview">
                        {t.preview}
                        <Icon name="external" size={14} />
                      </span>
                    </button>
                    <div className="pf-design-caption">
                      <div>
                        <span className="pf-design-index">
                          {template.number} /
                        </span>
                        <h3>{template.name}</h3>
                        <p>{t[template.note]}</p>
                      </div>
                      <button
                        className="pf-round-button"
                        onClick={() => create(template.id)}
                        disabled={busy}
                        aria-label={`${t.choose} ${template.name}`}
                      >
                        <Icon name="arrow" size={20} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {(view === "overview" || view === "invitations") && (
            <section className="pf-invitations">
              <div className="pf-section-heading">
                <div>
                  <span className="pf-eyebrow">YOUR PERSONAL COLLECTION</span>
                  <h2>{t.yours}</h2>
                </div>
                {view === "overview" && items.length > 0 && (
                  <button
                    className="pf-link"
                    onClick={() => setView("invitations")}
                  >
                    {t.allInvitations}
                    <Icon name="arrow" size={16} />
                  </button>
                )}
              </div>
              {view === "invitations" && (
                <div className="pf-list-tools">
                  <div className="pf-filter-tabs">
                    {["all", "draft", "published", "archived"].map((status) => (
                      <button
                        key={status}
                        aria-pressed={filter === status}
                        onClick={() => setFilter(status)}
                      >
                        {status === "all"
                          ? t.all
                          : t[status as "draft" | "published" | "archived"]}
                      </button>
                    ))}
                  </div>
                  <label className="pf-search">
                    <Icon name="search" size={17} />
                    <input
                      placeholder={t.search}
                      aria-label={t.search}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
              )}
              {loading ? (
                <p className="pf-muted">{t.loading}</p>
              ) : items.length === 0 ? (
                <div className="pf-empty">
                  <span className="pf-empty-icon">
                    <Icon name="mail" size={30} />
                  </span>
                  <div>
                    <h3>{t.emptyTitle}</h3>
                    <p>{t.emptyText}</p>
                  </div>
                  <button
                    className="pf-link"
                    onClick={() => setView("designs")}
                  >
                    {t.choose}
                    <Icon name="arrow" size={18} />
                  </button>
                </div>
              ) : (
                <div className="pf-invitation-list">
                  {(view === "overview" ? visible.slice(0, 3) : visible).map(
                    (item) => (
                      <article className="pf-invitation-row" key={item.id}>
                        <div
                          className={`pf-invitation-swatch pf-swatch-${item.templateId}`}
                        >
                          <Icon name={item.purpose === "greeting" ? "heart" : "mail"} size={24} />
                        </div>
                        <div className="pf-invitation-info">
                          <h3>
                            {item.title ||
                              item.names.filter(Boolean).join(" & ") ||
                              t.draft}
                          </h3>
                          <p>
                            {item.purpose === "greeting" ? t.greetingPurpose : item.date.day
                              ? new Intl.DateTimeFormat(
                                  locale === "ru" ? "ru-RU" : "uz-UZ",
                                  { dateStyle: "long", timeZone: "UTC" },
                                ).format(new Date(`${item.date.day}T12:00:00Z`))
                              : t.date + " —"}{" "}
                            <span>·</span>{" "}
                            {
                              platformTemplates.find(
                                (x) => x.id === item.templateId,
                              )?.name
                            }
                          </p>
                        </div>
                        <span className={`pf-status pf-status-${item.status}`}>
                          <span />
                          {
                            t[
                              item.status === "published"
                                ? "published"
                                : item.status === "archived"
                                  ? "archived"
                                  : "draft"
                            ]
                          }
                        </span>
                        <button
                          className="pf-button pf-button-outline"
                          onClick={() => openEditor(item.id)}
                          disabled={busy}
                        >
                          {t.edit}
                          <Icon name="arrow" size={15} />
                        </button>
                      </article>
                    ),
                  )}
                  {visible.length === 0 && (
                    <p className="pf-muted">{t.filterEmpty}</p>
                  )}
                </div>
              )}
            </section>
          )}
          {view === "guests" && (
            <GuestResponses items={items} locale={locale} />
          )}
          {view === "settings" && (
            <section className="pf-account">
              <div className="pf-account-icon">
                <Icon name="settings" size={28} />
              </div>
              <h2>{t.security}</h2>
              {user ? (
                <>
                  <dl>
                    <dt>{t.name}</dt>
                    <dd>{user.name}</dd>
                    <dt>{t.email}</dt>
                    <dd>{user.email}</dd>
                  </dl>
                  <p>{t.accountNote}</p>
                  <button
                    className="pf-button pf-button-outline"
                    onClick={logout}
                  >
                    <Icon name="logout" size={17} />
                    {t.logout}
                  </button>
                </>
              ) : (
                <>
                  <p>{t.accountText}</p>
                  <button
                    className="pf-button pf-button-dark"
                    onClick={() => setAuth("register")}
                  >
                    {t.register}
                    <Icon name="arrow" size={16} />
                  </button>
                </>
              )}
            </section>
          )}
          <footer className="pf-footer">
            <span>
              taklif<span className="pf-brand-dot">.</span>{" "}
              <small>{t.handmade}</small>
            </span>
            <span>
              <Icon name="heart" size={12} />
              {t.madeIn}
            </span>
          </footer>
        </main>
      </div>
      {auth && (
        <AuthModal
          mode={auth}
          locale={locale}
          onMode={setAuth}
          onClose={() => {
            setAuth(null);
            setPendingTemplate(null);
            setPendingAi(false);
          }}
          onAuthenticated={authenticated}
        />
      )}
      {aiWizard && user && (
        <AiBriefWizard locale={locale} userId={user.id} onClose={() => {
          setAiWizard(false);
          refresh().catch((e) => setError(e.message));
        }} onSuccess={(invitation, oldDraft) => {
          setAiWizard(false);
          setPreviousDraft(oldDraft);
          setEditor(invitation);
          refresh().catch((e) => setError(e.message));
        }} />
      )}
      {editor && (
        <InvitationEditor
          initial={editor}
          initialPreviousDraft={previousDraft}
          locale={locale}
          onClose={() => {
            setEditor(null);
            setPreviousDraft(undefined);
            refresh().catch((e) => setError(e.message));
          }}
        />
      )}
      {preview && (
        <Modal
          wide
          title={t.preview}
          closeLabel={t.close}
          onClose={() => setPreview(null)}
        >
          <div className="pf-preview-head">
            <div>
              <span className="pf-eyebrow">{t.demo}</span>
              <h2>{platformTemplates.find((x) => x.id === preview)?.name}</h2>
            </div>
            <button
              className="pf-button pf-button-dark"
              onClick={() => create(preview)}
              disabled={busy}
            >
              {t.choose}
              <Icon name="arrow" size={16} />
            </button>
          </div>
          <iframe
            className="pf-demo-frame"
            title={t.preview}
            src={`/dashboard/preview?template=${preview}&locale=${locale}`}
          />
          {preview === "heritage" && (
            <a
              className="pf-link pf-preview-entrance-link"
              href={`/dashboard/preview?template=heritage&locale=${locale}&entrance=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.entrancePreview}
              <Icon name="external" size={15} />
            </a>
          )}
        </Modal>
      )}
      {help && (
        <Modal
          title={t.helpTitle}
          closeLabel={t.close}
          onClose={() => setHelp(false)}
        >
          <span className="pf-eyebrow">TAKLIF / 01—05</span>
          <h2>{t.helpTitle}</h2>
          <ol className="pf-guide">
            <li>{t.helpOne}</li>
            <li>{t.helpTwo}</li>
            <li>{t.helpThree}</li>
          </ol>
          <p className="pf-muted">{t.noPayment}</p>
          <button
            className="pf-button pf-button-dark"
            onClick={() => {
              setHelp(false);
              setView("designs");
            }}
          >
            {t.choose}
            <Icon name="arrow" size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}

function AuthModal({
  mode,
  locale,
  onMode,
  onClose,
  onAuthenticated,
}: {
  mode: "login" | "register";
  locale: PlatformLocale;
  onMode: (mode: "login" | "register") => void;
  onClose: () => void;
  onAuthenticated: (user: PlatformUser) => Promise<void>;
}) {
  const t = platformCopy[locale];
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError("");
    setBusy(true);
    try {
      const result = await platformRequest<{ user: PlatformUser }>(
        `/auth/${mode}`,
        { method: "POST", body: JSON.stringify(Object.fromEntries(data)) },
      );
      await onAuthenticated(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={mode === "register" ? t.signUpTitle : t.signInTitle}
      onClose={onClose}
      closeLabel={t.close}
    >
      <div className="pf-auth-mark">
        <Icon name="flower" size={34} />
      </div>
      <span className="pf-eyebrow">WELCOME TO TAKLIF</span>
      <h2>{mode === "register" ? t.signUpTitle : t.signInTitle}</h2>
      <p className="pf-muted">{t.accountText}</p>
      <form className="pf-form" onSubmit={submit}>
        {mode === "register" && (
          <label>
            {t.name}
            <input name="name" autoComplete="name" required maxLength={100} />
          </label>
        )}
        <label>
          {t.email}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          {t.password}
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            required
            minLength={mode === "register" ? 10 : undefined}
            maxLength={128}
          />
          {mode === "register" && <small>{t.passwordHint}</small>}
        </label>
        {error && (
          <p className="pf-inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="pf-button pf-button-dark" disabled={busy}>
          {busy ? t.loading : mode === "register" ? t.register : t.login}
          <Icon name="arrow" size={16} />
        </button>
      </form>
      <button
        className="pf-auth-switch"
        onClick={() => {
          setError("");
          onMode(mode === "register" ? "login" : "register");
        }}
      >
        {mode === "register" ? t.haveAccount : t.newAccount}
      </button>
    </Modal>
  );
}

function GuestResponses({
  items,
  locale,
}: {
  items: InvitationSummary[];
  locale: PlatformLocale;
}) {
  const t = platformCopy[locale];
  const [selected, setSelected] = useState(items[0]?.id || "");
  const [responses, setResponses] = useState<RsvpRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    setResponses([]);
    setError("");
    if (!selected) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    platformRequest<{ responses: RsvpRecord[] }>(
      `/invitations/${selected}/rsvps`,
    )
      .then((result) => {
        if (!cancelled) setResponses(result.responses);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  const visible = responses.filter((x) =>
    x.name.toLowerCase().includes(search.toLowerCase()),
  );
  function exportCsv() {
    // Neutralize spreadsheet formula prefixes in untrusted guest-supplied cells.
    const csv = [
      [t.name, t.attendance, t.count, t.comment],
      ...responses.map((x) => [
        x.name,
        t[x.status],
        x.status === "yes" ? x.guestCount : "",
        x.message || "",
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "guest-responses.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="pf-guests">
      <div className="pf-list-tools">
        <select
          aria-label={t.invitations}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">{t.invitations}</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title || item.names.join(" & ") || t.draft}
            </option>
          ))}
        </select>
        <label className="pf-search">
          <Icon name="search" size={16} />
          <input
            placeholder={t.guestsSearch}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className="pf-button pf-button-outline"
          disabled={responses.length === 0}
          onClick={exportCsv}
        >
          {t.export}
        </button>
      </div>
      {error && (
        <p role="alert" className="pf-inline-error">
          {error}
        </p>
      )}
      {loading ? (
        <p>{t.loading}</p>
      ) : responses.length === 0 ? (
        <div className="pf-empty">
          <span className="pf-empty-icon">
            <Icon name="users" size={30} />
          </span>
          <div>
            <h3>{t.noGuests}</h3>
            <p>{t.guestsNote}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="pf-response-stats">
            {(["yes", "no", "maybe"] as const).map((status) => (
              <div key={status}>
                <span>
                  {
                    t[
                      status === "yes"
                        ? "confirmed"
                        : status === "no"
                          ? "declined"
                          : "undecided"
                    ]
                  }
                </span>
                <strong>
                  {responses.filter((x) => x.status === status).length}
                </strong>
              </div>
            ))}
            <div>
              <span>{t.count}</span>
              <strong>
                {responses
                  .filter((x) => x.status === "yes")
                  .reduce((sum, x) => sum + x.guestCount, 0)}
              </strong>
            </div>
          </div>
          <div className="pf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.name}</th>
                  <th>{t.attendance}</th>
                  <th>{t.count}</th>
                  <th>{t.comment}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((response) => (
                  <tr key={response.id}>
                    <td>{response.name}</td>
                    <td>
                      <span
                        className={`pf-status pf-response-${response.status}`}
                      >
                        {t[response.status]}
                      </span>
                    </td>
                    <td>
                      {response.status === "yes" ? response.guestCount : "—"}
                    </td>
                    <td>{response.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p>{t.noResults}</p>}
          </div>
        </>
      )}
    </section>
  );
}
