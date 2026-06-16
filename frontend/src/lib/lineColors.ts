const LINE_COLORS: Record<string, string> = {
  "1호선": "#0052A4",
  "2호선": "#00A84D",
  "3호선": "#EF7C1C",
  "4호선": "#00A5DE",
  "5호선": "#996CAC",
  "6호선": "#CD7C2F",
  "7호선": "#747F00",
  "8호선": "#E6186C",
  "9호선": "#BDB092",
  "경의중앙선": "#77C4A3",
  "공항철도": "#0090D2",
  "신분당선": "#D4003B",
  "수인분당선": "#F5A200",
  "우이신설선": "#B7C452",
  "서해선": "#8FC31F",
  "김포골드라인": "#A17800",
  "신림선": "#6789CA",
  "경춘선": "#0C8E72",
  "경강선": "#0054A6",
  "의정부경전철": "#FDA600",
  "용인경전철": "#509F22",
};

const LINE_CODE_NAMES: Record<string, string> = {
  "1": "1호선",
  "2": "2호선",
  "3": "3호선",
  "4": "4호선",
  "5": "5호선",
  "6": "6호선",
  "7": "7호선",
  "8": "8호선",
  "9": "9호선",
  "101": "공항철도",
  "104": "경의중앙선",
  "107": "경춘선",
  "108": "경강선",
  "109": "신분당선",
  "110": "의정부경전철",
  "111": "용인경전철",
  "112": "경강선",
  "113": "우이신설선",
  "114": "서해선",
  "115": "김포골드라인",
  "116": "수인분당선",
  "117": "신림선",
};

const LINE_LABELS: Record<string, string> = {
  "1호선": "1",
  "2호선": "2",
  "3호선": "3",
  "4호선": "4",
  "5호선": "5",
  "6호선": "6",
  "7호선": "7",
  "8호선": "8",
  "9호선": "9",
  "경의중앙선": "경",
  "공항철도": "공",
  "신분당선": "신",
  "수인분당선": "수",
  "우이신설선": "우",
  "서해선": "서",
  "김포골드라인": "김",
  "신림선": "신",
  "경춘선": "경",
  "경강선": "경",
  "의정부경전철": "의",
  "용인경전철": "용",
};

export function normalizeLineName(line?: string | number | null) {
  const value = String(line ?? "").trim();
  if (!value) return "";

  if (LINE_CODE_NAMES[value]) return LINE_CODE_NAMES[value];
  if (/^\d호선$/.test(value)) return value;
  if (/^\d$/.test(value)) return `${value}호선`;

  if (value.includes("수인") && value.includes("분당")) return "수인분당선";
  if (value.includes("서해")) return "서해선";
  if (value.includes("경의") && value.includes("중앙")) return "경의중앙선";
  if (value.includes("공항")) return "공항철도";
  if (value.includes("신분당")) return "신분당선";
  if (value.includes("우이") && value.includes("신설")) return "우이신설선";
  if (value.includes("김포") && value.includes("골드")) return "김포골드라인";
  if (value.includes("신림")) return "신림선";
  if (value.includes("경춘")) return "경춘선";
  if (value.includes("경강")) return "경강선";
  if (value.includes("의정부")) return "의정부경전철";
  if (value.includes("용인")) return "용인경전철";

  const numberedLine = value.match(/([1-9])호선/);
  if (numberedLine) return `${numberedLine[1]}호선`;

  return value;
}

export function getLineColor(line?: string | number | null) {
  return LINE_COLORS[normalizeLineName(line)] ?? "#6B7280";
}

export function getLineLabel(line?: string | number | null) {
  const lineName = normalizeLineName(line);
  return LINE_LABELS[lineName] ?? lineName.replace(/선$/, "") ?? "";
}

export function getLineDisplay(line?: string | number | null) {
  const lineName = normalizeLineName(line);

  return {
    color: getLineColor(lineName),
    label: getLineLabel(lineName),
    lineName,
  };
}
