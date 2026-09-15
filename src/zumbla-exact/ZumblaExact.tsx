import { useEffect, useRef, useState } from "react";
import "./globals.css";
type Tab = "home" | "cashier" | "deposit" | "history" | "profile" | "admin";
type Tx = {
  id: string;
  kind: "deposit" | "withdraw" | "bet" | "prize";
  amount: number;
  status: "PENDING" | "PAID" | "FAILED";
  at: string;
  note: string;
};
type GameMsg = {
  source: string;
  event: string;
  payload?: { levelScore?: number; totalScore?: number; levelName?: string };
};
const bets = [1, 2, 5, 10, 20];
const now = () =>
  new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
const multiplier = (points: number) =>
  points >= 3200 ? 5 : points >= 2200 ? 3 : points >= 1200 ? 2.5 : 2;
export default function ZumblaExact() {
  const [tab, setTab] = useState<Tab>("home"),
    [playing, setPlaying] = useState(false),
    [balance, setBalance] = useState(100),
    [bet, setBet] = useState(2),
    [round, setRound] = useState(false),
    [score, setScore] = useState(0),
    [txs, setTxs] = useState<Tx[]>([]),
    [modal, setModal] = useState<"" | "deposit" | "withdraw" | "kyc">(""),
    [toast, setToast] = useState("");
  const [depositAmount, setDepositAmount] = useState(50),
    [customDeposit, setCustomDeposit] = useState("50,00"),
    [pixCode, setPixCode] = useState(""),
    [pixImage, setPixImage] = useState(""),
    [paymentLink, setPaymentLink] = useState(""),
    [generatingPix, setGeneratingPix] = useState(false);
  const [user, setUser] = useState(""),
    [authMode, setAuthMode] = useState<"login" | "register">("login"),
    [authReady, setAuthReady] = useState(false),
    [win, setWin] = useState<{ value: number; multi: number } | null>(null),
    [loss, setLoss] = useState<{ value: number } | null>(null);
  const scoreRef = useRef(0);
  const betIdRef = useRef("");
  const roundStartedAtRef = useRef(0);
  const eventSequenceRef = useRef(0);
  const lastScoreTelemetryRef = useRef(0);
  const lossTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = useRef({ balance: 100, bet: 2, round: false, txs: [] as Tx[] });
  state.current = { balance, bet, round, txs };
  useEffect(() => {
    const token = localStorage.getItem("pg_auth_token") || localStorage.getItem("paygateway_token");
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token || ""}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sessão inválida");
        return response.json();
      })
      .then((data) => {
        setBalance(Number(data.balance || 0));
        setUser(data.name || "Jogador Zumbla");
      })
      .catch(() => setUser(localStorage.getItem("zumbla-user") || "Jogador Zumbla"))
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    const clickSound = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("button")) return;
      const AudioCtx = window.AudioContext;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(620, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(390, ctx.currentTime + 0.055);
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.065);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.07);
      oscillator.addEventListener("ended", () => ctx.close());
    };
    document.addEventListener("click", clickSound);
    return () => document.removeEventListener("click", clickSound);
  }, []);
  const persist = (b: number, t: Tx[]) =>
    localStorage.setItem(
      "zumbla-system-v2",
      JSON.stringify({ balance: b, txs: t }),
    );
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  const sendTelemetry = (type: string, scoreValue = scoreRef.current) => {
    if (!betIdRef.current) return;
    const token = localStorage.getItem("pg_auth_token") || localStorage.getItem("paygateway_token");
    eventSequenceRef.current += 1;
    fetch("/api/game/zumbla/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
      body: JSON.stringify({
        betId: betIdRef.current,
        type,
        score: scoreValue,
        elapsedMs: Math.max(0, Date.now() - roundStartedAtRef.current),
        sequence: eventSequenceRef.current,
      }),
      keepalive: true,
    }).catch(() => undefined);
  };
  const addTx = (
    kind: Tx["kind"],
    amount: number,
    status: Tx["status"],
    note: string,
    b = state.current.balance,
  ) => {
    const list = [
      { id: crypto.randomUUID(), kind, amount, status, at: now(), note },
      ...state.current.txs,
    ].slice(0, 40);
    setTxs(list);
    persist(b, list);
    return list;
  };
  useEffect(() => {
    const receive = async (e: MessageEvent<GameMsg>) => {
      if (e.origin !== location.origin || e.data?.source !== "zumbla-game")
        return;
      const s = state.current,
        ev = e.data.event;
      if (ev === "EVENT_LEVELSTART" && !s.round) {
        if (s.balance < s.bet) {
          notify("Saldo insuficiente. Abra o caixa.");
          setPlaying(false);
          return;
        }
        try {
          const token = localStorage.getItem("pg_auth_token") || localStorage.getItem("paygateway_token");
          let deviceId = localStorage.getItem("zumbla-device-id");
          if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem("zumbla-device-id", deviceId); }
          const response = await fetch("/api/game/zumbla/start", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ betAmount: s.bet, sessionId: crypto.randomUUID(), deviceId }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Não foi possível iniciar a rodada");
          betIdRef.current = data.betId;
          roundStartedAtRef.current = Date.now();
          eventSequenceRef.current = 0;
          lastScoreTelemetryRef.current = 0;
          setBalance(data.balance);
          setRound(true);
          addTx("bet", -s.bet, "PAID", "Entrada da rodada", data.balance);
          window.parent.postMessage({ source: "zumbla-shell", event: "balance", balance: data.balance }, location.origin);
          notify("Entrada confirmada");
          sendTelemetry("START", 0);
        } catch (error) {
          notify(error instanceof Error ? error.message : "Erro ao iniciar a rodada");
          setPlaying(false);
        }
      }
      if (ev === "EVENT_LEVELSCORE") {
        const points = Number(e.data.payload?.levelScore || 0);
        scoreRef.current = points;
        setScore(points);
        if (Date.now() - lastScoreTelemetryRef.current >= 1000) {
          lastScoreTelemetryRef.current = Date.now();
          sendTelemetry("SCORE", points);
        }
      }
      if (ev === "EVENT_LEVELSUCCESS" && s.round) {
        sendTelemetry("SUCCESS");
        try {
          const token = localStorage.getItem("pg_auth_token") || localStorage.getItem("paygateway_token");
          await new Promise((resolve) => setTimeout(resolve, 80));
          const response = await fetch("/api/game/zumbla/settle", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ betId: betIdRef.current, outcome: "win", score: scoreRef.current }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Não foi possível finalizar a rodada");
          setWin({ value: data.payout, multi: data.multiplier });
          setBalance(data.balance);
          setRound(false);
          betIdRef.current = "";
          addTx("prize", data.payout, "PAID", "Vitória " + data.multiplier + "×", data.balance);
          window.parent.postMessage({ source: "zumbla-shell", event: "balance", balance: data.balance }, location.origin);
        } catch (error) { notify(error instanceof Error ? error.message : "Erro ao finalizar a rodada"); }
      }
      if (ev === "EVENT_LEVELFAIL" && s.round) {
        sendTelemetry("FAIL");
        try {
          const token = localStorage.getItem("pg_auth_token") || localStorage.getItem("paygateway_token");
          const response = await fetch("/api/game/zumbla/settle", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ betId: betIdRef.current, outcome: "loss", score: scoreRef.current }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Não foi possível finalizar a rodada");
          setBalance(data.balance);
          setRound(false);
          betIdRef.current = "";
          addTx("bet", 0, "PAID", "Rodada encerrada sem prêmio", data.balance);
          setLoss({ value: data.betAmount });
          window.parent.postMessage({ source: "zumbla-shell", event: "balance", balance: data.balance }, location.origin);
        } catch (error) { notify(error instanceof Error ? error.message : "Erro ao finalizar a rodada"); }
        lossTimerRef.current = setTimeout(() => {
          setLoss(null);
          setPlaying(false);
          setTab("home");
          setScore(0);
        }, 2400);
      }
    };
    window.addEventListener("message", receive as EventListener);
    return () =>
      window.removeEventListener("message", receive as EventListener);
  }, []);
  const createPix = async () => {
    const parsed = Number(customDeposit.replace(/\./g, "").replace(",", "."));
    const value = Number.isFinite(parsed) && parsed >= 10 ? parsed : depositAmount;
    setGeneratingPix(true);
    try {
      const token = localStorage.getItem("pg_auth_token") || localStorage.getItem("paygateway_token");
      const response = await fetch("/api/charges", {method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token || ""}`},body:JSON.stringify({value})});
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || "Não foi possível gerar o PIX");
      setDepositAmount(value);
      setPixCode(result.data.qrCode || "");
      setPixImage(result.data.qrCodeImage || "");
      setPaymentLink(result.data.paymentLink || "");
      addTx("deposit", value, "PENDING", `PIX Dotfy ${result.data.correlationID || "aguardando"}`);
      notify("PIX gerado com sucesso");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao gerar PIX");
    } finally {
      setGeneratingPix(false);
    }
  };
  const requestWithdraw = () => {
    if (balance < 20) {
      notify("Saldo mínimo para saque: R$ 20,00");
      return;
    }
    const b = balance - 20;
    setBalance(b);
    addTx("withdraw", -20, "PENDING", "Saque PIX em análise", b);
    setModal("");
    notify("Saque enviado para análise");
  };
  const authenticate = () => {
    const name = authMode === "register" ? "Novo Jogador" : "Jogador Zumbla";
    localStorage.setItem("zumbla-user", name);
    setUser(name);
    notify(
      authMode === "register" ? "Conta criada com sucesso" : "Login realizado",
    );
  };
  const victories = txs.filter((t) => t.kind === "prize").length;
  const rounds = txs.filter((t) => t.kind === "bet" && t.amount < 0).length;
  const streak =
    txs.findIndex((t) => t.kind === "bet" && t.note.includes("encerrada")) < 0
      ? victories
      : Math.min(victories, 3);
  const claimDaily = () => {
    const key = "zumbla-daily-" + new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key)) {
      notify("Recompensa diária já coletada");
      return;
    }
    localStorage.setItem(key, "1");
    const b = state.current.balance + 2;
    setBalance(b);
    addTx("prize", 2, "PAID", "Recompensa diária", b);
    notify("Recompensa diária: + R$ 2,00");
  };
  if (!authReady) return <main className="auth-screen" />;
  if (!user)
    return (
      <main className="auth-screen jungle-auth">
        <div className="auth-glow" />
        <section className={"auth-card " + authMode}>
          <div className="game-logo-type">
            <b>ZUMBLA</b>
            <em>WIN</em>
          </div>
          {authMode === "login" && (
            <div className="auth-character" aria-hidden="true" />
          )}
          <small className="auth-tag">
            {authMode === "login" ? "BEM-VINDO DE VOLTA" : "CRIE SUA CONTA"}
          </small>
          {authMode === "register" && (
            <div className="register-progress">
              <b>1/3</b>
              <span>
                <i />
              </span>
            </div>
          )}
          <h1>
            {authMode === "login"
              ? "Entre para continuar"
              : "Comece sua jornada"}
          </h1>
          <p>
            {authMode === "login"
              ? "Acesse sua carteira e continue jogando."
              : "Preencha seus dados para criar sua conta."}
          </p>
          {authMode === "register" && (
            <label className="field field-name">
              Nome completo
              <input placeholder="Seu nome completo" />
            </label>
          )}
          <label className="field field-email">
            E-mail
            <input type="email" placeholder="voce@email.com" />
          </label>
          {authMode === "register" && (
            <label className="field field-phone">
              Celular
              <input placeholder="(00) 00000-0000" />
            </label>
          )}
          <label className="field field-password">
            Senha
            <input type="password" placeholder="••••••••" />
          </label>
          {authMode === "login" ? (
            <div className="auth-options">
              <label>
                <input type="checkbox" /> Lembrar-me
              </label>
              <button>Esqueci minha senha</button>
            </div>
          ) : (
            <label className="terms">
              <input type="checkbox" /> Li e aceito os Termos de Uso
            </label>
          )}
          <button
            className={"auth-submit " + (authMode === "register" ? "gold" : "")}
            onClick={authenticate}
          >
            {authMode === "login" ? "ENTRAR E JOGAR" : "CONTINUAR"}{" "}
            <span>▶</span>
          </button>
          {authMode === "login" && (
            <>
              <div className="auth-divider">
                <span>ou continue com</span>
              </div>
            <div className="social-login">
              <button aria-label="Entrar com Google">
                <img src="/zumbla/google.svg" alt="Google" />
              </button>
              <button aria-label="Entrar com Apple">
                <img src="/zumbla/apple.svg" alt="Apple" />
              </button>
            </div>
            </>
          )}
          <button
            className="auth-switch"
            onClick={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
          >
            {authMode === "login" ? "Criar minha conta" : "Já tenho uma conta"}
          </button>
          <div className="auth-safe">18+ • Jogue com responsabilidade</div>
        </section>
      </main>
    );
  if (playing)
    return (
      <main className="play-screen">
        <header className="game-hud">
          <button className="hud-back asset-control" onClick={() => setPlaying(false)} aria-label="Voltar"><img src="/zumbla/ui-buttons/back.webp" alt="" /></button>
          <div className="hud-card hud-balance">
            <img src="/zumbla/mockup-icons/wallet.webp" alt="" />
            <span>
            <small>SALDO</small>
            <b>R$ {balance.toFixed(2).replace(".", ",")}</b>
            </span>
          </div>
          <div className="hud-card">
            <span className="hud-coin">●</span>
            <span>
            <small>ENTRADA</small>
            <b>R$ {bet.toFixed(2).replace(".", ",")}</b>
            </span>
          </div>
          <div className="hud-card">
            <span className="hud-star">★</span>
            <span>
            <small>PONTOS</small>
            <b>{score}</b>
            </span>
          </div>
          <span className={(round ? "on" : "off") + " hud-status"}>
            <i />
            {round ? "ATIVA" : "PRONTA"}
          </span>
        </header>
        <iframe
          src="/zumbla/game/index.html"
          title="Zumbla Win"
          allow="fullscreen; autoplay"
        />
        <footer className="game-controls">
          <button className="control-round asset-control" aria-label="Som"><img src="/zumbla/ui-buttons/sound.webp" alt="" /></button>
          <button className="control-round asset-control control-help" aria-label="Ajuda"><img src="/zumbla/ui-buttons/help.webp" alt="" /></button>
          <div className="control-multi"><small>MULTIPLICADOR</small><b>5×</b></div>
          <div className="control-stage"><small>RODADA</small><b>{Math.min(rounds + 1, 10)}/10</b></div>
          <button className="control-round asset-control"
            onClick={() => document.documentElement.requestFullscreen?.()}
            aria-label="Tela cheia"
          >
            <img src="/zumbla/ui-buttons/fullscreen.webp" alt="" />
          </button>
        </footer>
        {win && (
          <div className="win-overlay">
            <section className="win-popup">
              <div className="win-rays" />
              <div className="win-sparks"><i /><i /><i /><i /><i /><i /></div>
              <span className="win-trophy"><i>★</i></span>
              <small>VITÓRIA!</small>
              <div className="win-value">
                <span>PRÊMIO DA RODADA</span>
                <h2>R$ {win.value.toFixed(2).replace(".", ",")}</h2>
              </div>
              <b className="win-multiplier"><span>MULTIPLICADOR</span>{win.multi}×</b>
              <p>Seu prêmio já está disponível no saldo.</p>
              <button
                className="asset-button prize-asset"
                onClick={() => {
                  setWin(null);
                  setPlaying(false);
                  setTab("home");
                  setScore(0);
                }}
              >
                <img src="/zumbla/ui-buttons/prize.webp" alt="Receber prêmio" />
              </button>
            </section>
          </div>
        )}
        {loss && (
          <div className="loss-overlay">
            <section className="loss-popup">
              <div className="loss-pattern" />
              <span className="loss-icon">×</span>
              <small>RODADA ENCERRADA</small>
              <h2>NÃO FOI<br />DESSA VEZ</h2>
              <div className="loss-value"><span>VALOR DA ENTRADA</span><b>R$ {loss.value.toFixed(2).replace(".", ",")}</b></div>
              <p>Voltando para o início...</p>
              <i className="loss-timer" />
              <button onClick={() => {if(lossTimerRef.current)clearTimeout(lossTimerRef.current);setLoss(null);setPlaying(false);setTab("home");setScore(0)}}>VOLTAR AGORA</button>
            </section>
          </div>
        )}
      </main>
    );
  return (
    <main className="system-shell">
      {toast && <div className="toast">✓ {toast}</div>}
      <header className="system-top">
        <button className="brand jungle-brand" onClick={() => setTab("home")}>
          <span>ZUMBLA</span>
          <strong>WIN</strong>
        </button>
        <div className="player-level">
          <img className="level-avatar" src="/zumbla/avatar.webp" alt="Avatar do jogador" width="48" height="48" decoding="async" />
          <div className="level-info">
            <div className="level-label"><small>NÍVEL 12</small><b>72%</b></div>
            <div className="level-track" role="progressbar" aria-label="Progresso do nível 12" aria-valuenow={72} aria-valuemin={0} aria-valuemax={100}><i /></div>
          </div>
        </div>
        <button className="cash-pill" onClick={() => setTab("cashier")}>
          <img className="cash-wallet" src="/zumbla/mockup-icons/wallet.webp" alt="" />
          <b>R$ {balance.toFixed(2).replace(".", ",")}</b>
          <img className="cash-add" src="/zumbla/mockup-icons/add.webp" alt="Adicionar saldo" />
        </button>
      </header>
      {tab === "home" && (
        <>
          <section className="gaming-hero">
            <button className="hero-banner-button" onClick={() => setPlaying(true)} aria-label="Jogar Zumbla Win">
              <img src="/zumbla/banner-zumbla-win.webp" alt="Acerte, multiplique e conquiste — até 5 vezes" width="469" height="288" loading="eager" fetchPriority="high" decoding="async" />
            </button>
          </section>
          <section className="player-hub">
            <button className="daily-card hub-info-card" onClick={claimDaily} aria-label="Coletar prêmio diário">
              <span><img src="/zumbla/mockup-icons/chest.webp" alt="Baú de prêmio diário" /></span>
              <b>PRÊMIO DIÁRIO<small>+ R$ 2,00</small></b>
              <em>Resgate já!</em>
            </button>
            <button className="hub-info-card" aria-label={`Liga Bronze, ${victories} vitórias`}>
              <span><img src="/zumbla/mockup-icons/bronze.webp" alt="Liga Bronze" /></span>
              <b>LIGA BRONZE<small>{victories} vitórias</small></b>
              <em>Próx. liga</em>
            </button>
            <button className="hub-info-card fire-info-card" onClick={() => setTab("history")} aria-label={`Ver histórico, sequência ${rounds}`}>
              <span><img src="/zumbla/mockup-icons/fire.webp" alt="Partidas" /></span>
              <b>SEQUÊNCIA <strong>{Math.max(3, rounds)}</strong></b>
              <em>Continue!</em>
            </button>
          </section>
          <section className="entry-box power-box">
            <div className="box-head">
              <small>ESCOLHA SUA ENTRADA</small>
            </div>
            <div className="bet-options">
              {bets.map((v) => (
                <button
                  key={v}
                  className={bet === v ? "selected" : ""}
                  onClick={() => setBet(v)}
                >
                  <small>ENTRADA</small>R$ {v}
                </button>
              ))}
            </div>
            <div className="play-summary-row">
              <div className="potential">
                <span>PRÊMIO POTENCIAL</span>
                <b>R$ {(bet * 5).toFixed(2).replace(".", ",")}</b>
              </div>
              <button
                className="launch gaming-launch asset-button launch-asset"
                disabled={balance < bet}
                onClick={() => setPlaying(true)}
              >
                <img src="/zumbla/ui-buttons/play.webp" alt="Jogar agora" />
              </button>
            </div>
            {balance < bet && (
              <button className="link-btn" onClick={() => setTab("cashier")}>
                Adicionar saldo
              </button>
            )}
          </section>
        </>
      )}
      {tab === "deposit" && (
        <section className="inner-page deposit-page">
          <PageTitle label="CARTEIRA" title="Fazer depósito" desc="Adicione saldo via PIX" />
          <div className="pix-intro">
            <span className="pix-mark"><img src="/zumbla/pix-logo.webp" alt="PIX" width="62" height="62" /></span>
            <div><b>Depósito instantâneo</b><small>Via PIX você adiciona saldo na hora, todos os dias.</small></div>
          </div>
          <div className="deposit-heading"><span />ESCOLHA UM VALOR<span /></div>
          <div className="deposit-values">
            {[10,20,30,50,100,200].map((value) => <button key={value} className={depositAmount === value ? "selected" : ""} onClick={() => {setDepositAmount(value);setCustomDeposit(value.toFixed(2).replace(".", ","));setPixCode("")}}>R$ {value}</button>)}
          </div>
          <label className="custom-deposit"><small>Outro valor</small><span>R$</span><input inputMode="decimal" value={customDeposit} onChange={(e) => {setCustomDeposit(e.target.value);setPixCode("")}} aria-label="Outro valor para depósito" /></label>
          <div className="deposit-bonus bonus-shine"><img src="/zumbla/mockup-icons/chest.webp" alt="" /><div><b>100% DE BÔNUS</b><strong>NO PRIMEIRO DEPÓSITO</strong></div></div>
          {!pixCode ? <button className="generate-pix" onClick={createPix} disabled={generatingPix}><span><img src="/zumbla/pix-logo.webp" alt="" /></span><strong>{generatingPix ? "GERANDO..." : "GERAR PIX"}</strong><b>R$ {depositAmount.toFixed(2).replace(".", ",")}</b></button> : <div className="pix-generated">{pixImage && <img className="pix-qr" src={pixImage} alt="QR Code PIX" />}<small>PIX COPIA E COLA</small><code>{pixCode}</code><button onClick={async () => {await navigator.clipboard?.writeText(pixCode);notify("Código PIX copiado")}}>COPIAR CÓDIGO PIX</button>{paymentLink && <a href={paymentLink} target="_blank" rel="noreferrer">ABRIR PÁGINA DE PAGAMENTO</a>}</div>}
          <p className="deposit-safe">🔒 Pagamento seguro • Aprovação instantânea</p>
        </section>
      )}
      {tab === "cashier" && (
        <section className="inner-page">
          <PageTitle
            label="CARTEIRA"
            title="Caixa"
            desc="Depósitos, saques e movimentações."
          />
          <div className="cash-balance">
            <small>SALDO DISPONÍVEL</small>
            <h2>R$ {balance.toFixed(2).replace(".", ",")}</h2>
            <div>
              <button className="asset-button cash-asset" onClick={() => setTab("deposit")}><img src="/zumbla/ui-buttons/deposit.webp" alt="Depositar" /></button>
              <button className="asset-button cash-asset" onClick={() => setModal("withdraw")}><img src="/zumbla/ui-buttons/withdraw.webp" alt="Sacar" /></button>
            </div>
          </div>
          <div className="cash-actions">
            <button onClick={() => setTab("deposit")}>
              <span><img src="/zumbla/mockup-icons/add.webp" alt="" /></span>
              <b>
                PIX copia e cola<small>Gere uma cobrança instantânea</small>
              </b>
              <em>›</em>
            </button>
            <button onClick={() => setModal("withdraw")}>
              <span><img src="/zumbla/mockup-icons/wallet.webp" alt="" /></span>
              <b>
                Saque por chave PIX
                <small>CPF, e-mail, telefone ou aleatória</small>
              </b>
              <em>›</em>
            </button>
            <button onClick={() => setModal("kyc")}>
              <span><img src="/zumbla/mockup-icons/check-on.webp" alt="" /></span>
              <b>
                Verificação KYC<small>Necessária para liberar saques</small>
              </b>
              <em>›</em>
            </button>
          </div>
          <Recent txs={txs} />
        </section>
      )}
      {tab === "history" && (
        <section className="inner-page">
          <PageTitle
            label="AUDITORIA"
            title="Histórico completo"
            desc="Cada entrada, prêmio, depósito e saque."
          />
          <div className="filters">
            <button className="active">Todos</button>
            <button>Jogo</button>
            <button>PIX</button>
          </div>
          <Recent txs={txs} />
        </section>
      )}
      {tab === "profile" && (
        <section className="inner-page">
          <PageTitle label="CONTA" title={user} desc="ID #ZW-28491" />
          <div className="account-card">
            <span><img src="/zumbla/mockup-icons/profile-green.webp" alt="" /></span>
            <div>
              <b>Conta verificada parcialmente</b>
              <small>Complete o KYC para liberar saques</small>
              <progress value="2" max="3" />
            </div>
          </div>
          <div className="cash-actions">
            <button onClick={() => setModal("kyc")}>
              <span><img src="/zumbla/mockup-icons/check-on.webp" alt="" /></span>
              <b>
                Documentos e selfie<small>2 de 3 etapas concluídas</small>
              </b>
              <em>›</em>
            </button>
            <button>
              <span><img src="/zumbla/mockup-icons/fire.webp" alt="" /></span>
              <b>
                Limites de jogo<small>Defina limites diários e pausas</small>
              </b>
              <em>›</em>
            </button>
            <button onClick={() => setTab("admin")}>
              <span><img src="/zumbla/mockup-icons/cashier.webp" alt="" /></span>
              <b>
                Painel administrativo<small>Controle financeiro e jogo</small>
              </b>
              <em>›</em>
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("zumbla-user");
                setUser("");
              }}
            >
              <span><img src="/zumbla/mockup-icons/profile.webp" alt="" /></span>
              <b>
                Sair da conta<small>Voltar para o login</small>
              </b>
              <em>›</em>
            </button>
          </div>
        </section>
      )}
      {tab === "admin" && (
        <section className="inner-page">
          <PageTitle
            label="ADMIN"
            title="Operação Zumbla"
            desc="Indicadores e controles do sistema."
          />
          <div className="admin-grid">
            <Kpi
              l="GGR"
              v={
                "R$ " +
                Math.abs(
                  txs
                    .filter((t) => t.kind === "bet")
                    .reduce((a, t) => a + t.amount, 0),
                ).toFixed(2)
              }
              s="Jogo"
            />
            <Kpi
              l="Depósitos"
              v={String(
                txs.filter((t) => t.kind === "deposit" && t.status === "PAID")
                  .length,
              )}
              s="Aprovados"
            />
            <Kpi
              l="Saques"
              v={String(
                txs.filter(
                  (t) => t.kind === "withdraw" && t.status === "PENDING",
                ).length,
              )}
              s="Pendentes"
            />
            <Kpi
              l="Rodadas"
              v={String(
                txs.filter((t) => t.kind === "bet" && t.amount < 0).length,
              )}
              s="Total"
            />
          </div>
          <div className="admin-menu">
            <button>⚙ Configurar entradas e prêmio</button>
            <button>◆ Financeiro e conciliação</button>
            <button>✓ KYC e antifraude</button>
            <button>◷ Logs e auditoria</button>
            <button>♧ Afiliados e comissões</button>
            <button>⌁ Integrações e webhooks</button>
          </div>
        </section>
      )}
      <nav className="system-nav five-nav">
        {(
          [
            ["/mockup-icons/home.webp", "Início", "home"],
            ["/mockup-icons/cashier.webp", "Caixa", "cashier"],
            ["/mockup-icons/play.webp", "Jogar", "home"],
            ["/mockup-icons/add.webp", "Depósito", "deposit"],
            ["/mockup-icons/profile.webp", "Perfil", "profile"],
          ] as [string, string, Tab][]
        ).map(([i, l, t], idx) => (
          <button
            key={l}
            className={
              (tab === t ? "active " : "") + (idx === 2 ? "play-center" : "")
            }
            onClick={() => idx === 2 ? setPlaying(true) : setTab(t)}
          >
            <span><img src={i} alt="" /></span>
            <small>{l}</small>
          </button>
        ))}
      </nav>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          {modal === "deposit" ? (
            <section
              className="modal cashier-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setModal("")}>
                ×
              </button>
              <div className="modal-icon">▦</div>
              <h2>Depositar via PIX</h2>
              <p>Valor selecionado: R$ 50,00</p>
              <div className="qr-placeholder">
                <b>PIX</b>
                <span>QR CODE</span>
              </div>
              <button className="modal-primary" onClick={() => {setModal("");setTab("deposit")}}>
                Gerar PIX copia e cola
              </button>
              <small className="gateway-note">
                Fluxo técnico simulado. Conecte Dotfy/AmploPay para cobrança
                real.
              </small>
            </section>
          ) : modal === "withdraw" ? (
            <section
              className="modal cashier-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setModal("")}>
                ×
              </button>
              <div className="modal-icon">↗</div>
              <h2>Saque PIX</h2>
              <p>Solicitação padrão de R$ 20,00.</p>
              <label>
                Tipo de chave
                <select>
                  <option>CPF</option>
                  <option>E-mail</option>
                  <option>Telefone</option>
                  <option>Aleatória</option>
                </select>
              </label>
              <label>
                Chave PIX
                <input placeholder="Digite sua chave" />
              </label>
              <button className="modal-primary" onClick={requestWithdraw}>
                Solicitar saque
              </button>
              <small className="gateway-note">
                Processamento real exige KYC e gateway de payout.
              </small>
            </section>
          ) : (
            <section
              className="modal cashier-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setModal("")}>
                ×
              </button>
              <div className="modal-icon">✓</div>
              <h2>Verificação KYC</h2>
              <p>Proteção da conta e liberação de saques.</p>
              <div className="kyc-steps">
                <b>✓ Dados pessoais</b>
                <b>✓ Documento com foto</b>
                <b>○ Selfie com movimento</b>
              </div>
              <button
                className="modal-primary"
                onClick={() => {
                  setModal("");
                  notify("Etapa KYC preparada");
                }}
              >
                Continuar verificação
              </button>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
function PageTitle({
  label,
  title,
  desc,
}: {
  label: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="page-title">
      <small>{label}</small>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
  );
}
function Stats({ txs }: { txs: Tx[] }) {
  const wins = txs.filter((t) => t.kind === "prize").length,
    rounds = txs.filter((t) => t.kind === "bet" && t.amount < 0).length;
  return (
    <section className="game-stats">
      <div>
        <small>RODADAS</small>
        <b>{rounds}</b>
      </div>
      <div>
        <small>VITÓRIAS</small>
        <b>{wins}</b>
      </div>
      <div>
        <small>TAXA</small>
        <b>{rounds ? Math.round((wins / rounds) * 100) : 0}%</b>
      </div>
    </section>
  );
}
function Recent({ txs }: { txs: Tx[] }) {
  return (
    <section className="recent">
      <div className="section-title">
        <small>MOVIMENTAÇÕES</small>
        <h2>Atividade recente</h2>
      </div>
      {txs.length ? (
        <div className="tx-list">
          {txs.map((t) => (
            <div key={t.id}>
              <span className={t.kind}>
                <img src={t.kind === "deposit" ? "/mockup-icons/add.webp" : t.kind === "withdraw" ? "/mockup-icons/wallet.webp" : t.kind === "prize" ? "/mockup-icons/chest.webp" : "/mockup-icons/play.webp"} alt="" />
              </span>
              <b>
                {t.note}
                <small>
                  {t.at} • {t.status}
                </small>
              </b>
              <em className={t.amount >= 0 ? "positive" : "negative"}>
                {t.amount > 0 ? "+" : ""} R${" "}
                {Math.abs(t.amount).toFixed(2).replace(".", ",")}
              </em>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Nenhuma movimentação registrada.</div>
      )}
    </section>
  );
}
function Quest({
  icon,
  title,
  value,
  max,
  reward,
}: {
  icon: string;
  title: string;
  value: number;
  max: number;
  reward: string;
}) {
  return (
    <article className="quest">
      <span>{icon}</span>
      <div>
        <b>{title}</b>
        <progress value={value} max={max} />
        <small>
          {value.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}
        </small>
      </div>
      <em>{reward}</em>
    </article>
  );
}
function Kpi({ l, v, s }: { l: string; v: string; s: string }) {
  return (
    <div>
      <small>{l}</small>
      <b>{v}</b>
      <span>{s}</span>
    </div>
  );
}
