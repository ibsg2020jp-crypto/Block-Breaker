const REQUEST_TIMEOUT_MS = 9000;

export function sanitizePlayerName(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10);
}

export function submitScore(apiUrl, scoreData) {
  return jsonpRequest(apiUrl, {
    action: "submit",
    name: sanitizePlayerName(scoreData.name),
    score: Math.floor(Number(scoreData.score) || 0),
    stageId: Math.floor(Number(scoreData.stageId) || 0),
    stageName: String(scoreData.stageName || "").slice(0, 40),
    difficulty: String(scoreData.difficulty || "").slice(0, 20),
    ballSpeed: String(scoreData.ballSpeed || "").slice(0, 10),
    clearTime: String(scoreData.clearTime || "").slice(0, 20)
  });
}

export function fetchRanking(apiUrl, options = {}) {
  return jsonpRequest(apiUrl, {
    action: "ranking",
    stageId: Math.floor(Number(options.stageId) || 0),
    limit: Math.min(Math.max(Math.floor(Number(options.limit) || 10), 1), 50)
  });
}

function jsonpRequest(apiUrl, params) {
  return new Promise((resolve, reject) => {
    if (!apiUrl) {
      reject(new Error("ランキングAPIのURLが設定されていません。"));
      return;
    }

    const callbackName = `blockBreakerRanking_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(apiUrl);
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("ランキング通信がタイムアウトしました。"));
    }, REQUEST_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (data) => {
      cleanup();
      if (data?.ok === false) {
        reject(new Error(data.error || "ランキングAPIでエラーが発生しました。"));
        return;
      }
      resolve(data);
    };

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
    url.searchParams.set("callback", callbackName);

    script.onerror = () => {
      cleanup();
      reject(new Error("ランキングAPIに接続できませんでした。"));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}
