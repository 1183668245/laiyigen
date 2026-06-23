
const MAINNET_FACTORY = "0x1Be5b00B731F08f6A4892c8046d4D1dF68F9D81a";
const MAINNET_RPC = "https://bsc-dataseed.binance.org/";

const MAINNET_VAULT = "";

const FACTORY_ABI = [
  "event LightOneVaultDeployed(address indexed vault,address indexed taxToken,address indexed lpPair,address creator)",
];

const VAULT_ABI = [
  "function taxToken() view returns (address)",
  "function dashboardDisplayStats() view returns ((uint8 currentLitStage,uint8 phase,uint256 marketCapNative,uint256 marketCapUsd,uint256 marketCapK,uint256 liquidityNative,uint256 currentStageExecutedAt,uint8 upcomingStage,uint256 upcomingThresholdNative,uint256 upcomingThresholdUsd,uint256 upcomingThresholdK,uint256 upcomingMinLiquidity,bool canAdvanceUpcomingStage,uint256 totalStakedAmount,uint256 totalStakingWeight,uint256 stakingUserCount,uint256 burnedTokenBalance))",
  "function pendingStakingBNB() view returns (uint256)",
  "function pendingBuybackBNB() view returns (uint256)",
  "function pendingLPBNB() view returns (uint256)",
  "function luckyVaultBNB() view returns (uint256)",
  "function totalTaxReceivedBNB() view returns (uint256)",
];

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// =========================
// 页面节点
// =========================
const menuBtn = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");
const navLinks = document.querySelectorAll(".nav-links a, .mobile-menu a");
const stageTrack = document.getElementById("stageTrack");
const els = {
  currentStage: document.getElementById("currentStageValue"),
  marketCap: document.getElementById("marketCapValue"),
  progress: document.getElementById("progressValue"),
  progressBar: document.getElementById("progressBarFill"),
  pendingStaking: document.getElementById("pendingStakingValue"),
  pendingBuyback: document.getElementById("pendingBuybackValue"),
  pendingLP: document.getElementById("pendingLPValue"),
  luckyVault: document.getElementById("luckyVaultValue"),
  totalTax: document.getElementById("totalTaxValue"),
  burned: document.getElementById("burnedTokenValue"),
  burnedUnit: document.getElementById("burnedTokenUnit"),
  totalWeight: document.getElementById("totalWeightValue"),
  totalStaked: document.getElementById("totalStakedValue"),
  totalStakedUnit: document.getElementById("totalStakedUnit"),
  stakerCount: document.getElementById("stakerCountValue"),
};

// =========================
// 页面交互
// =========================
if (menuBtn && mobileMenu) {
  menuBtn.addEventListener("click", () => mobileMenu.classList.toggle("show"));
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => mobileMenu?.classList.remove("show"));
});

function buildStageTrack(current = 0, total = 20) {
  if (!stageTrack) return;
  const nodes = [];

  for (let i = 1; i <= total; i += 1) {
    let cls = "stage-node";
    if (current > 0 && i < current) cls += " done";
    if (current > 0 && i === current) cls += " current";
    nodes.push(`<div class="${cls}">${String(i).padStart(2, "0")}</div>`);
  }

  stageTrack.innerHTML = nodes.join("");
}

function updateActiveNav() {
  const sections = [...document.querySelectorAll("section[id]")];
  const scrollY = window.scrollY + 120;
  let currentId = "home";

  sections.forEach((section) => {
    if (scrollY >= section.offsetTop) currentId = section.id;
  });

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${currentId}`);
  });
}

// =========================
// 数据格式化
// =========================
function setText(el, value) {
  if (el) el.textContent = value;
}

function fmtNum(num, digits = 2) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

function fmtBNB(value) {
  return fmtNum(Number(ethers.formatEther(value)), 3);
}

function fmtToken(value, decimals = 18, digits = 0) {
  return fmtNum(Number(ethers.formatUnits(value, decimals)), digits);
}

function fmtUsd(value) {
  const n = Number(ethers.formatUnits(value, 18));
  return `${fmtNum(n / 1e3, 1)}K`;
}
async function resolveVaultAddress(provider) {
  if (MAINNET_VAULT) return MAINNET_VAULT;

  const iface = new ethers.Interface(FACTORY_ABI);
  const topic = ethers.id("LightOneVaultDeployed(address,address,address,address)");
  const logs = await provider.getLogs({
    address: MAINNET_FACTORY,
    topics: [topic],
    fromBlock: 0,
    toBlock: "latest",
  });

  if (!logs.length) throw new Error("No vault deployed");
  const parsed = iface.parseLog(logs[logs.length - 1]);
  return parsed.args.vault;
}

async function loadOnchainData() {
  if (!window.ethers) return;

  try {
    const provider = new ethers.JsonRpcProvider(MAINNET_RPC, 56);
    const vaultAddress = await resolveVaultAddress(provider);
    const vault = new ethers.Contract(vaultAddress, VAULT_ABI, provider);
    const token = new ethers.Contract(await vault.taxToken(), ERC20_ABI, provider);

    const [stats, pendingStaking, pendingBuyback, pendingLP, luckyVault, totalTax, symbol, decimals] = await Promise.all([
      vault.dashboardDisplayStats(),
      vault.pendingStakingBNB(),
      vault.pendingBuybackBNB(),
      vault.pendingLPBNB(),
      vault.luckyVaultBNB(),
      vault.totalTaxReceivedBNB(),
      token.symbol(),
      token.decimals(),
    ]);

    const currentStage = Number(stats.currentLitStage) > 0 ? Number(stats.currentLitStage) : 1;
    const target = stats.upcomingThresholdUsd > 0n ? fmtUsd(stats.upcomingThresholdUsd) : "Endless";
    const pct = stats.upcomingThresholdUsd > 0n
      ? Math.min(100, Number((stats.marketCapUsd * 10000n) / stats.upcomingThresholdUsd) / 100)
      : 100;

    buildStageTrack(currentStage, 20);
    setText(els.currentStage, `第 ${currentStage} 根烟`);
    setText(els.marketCap, `${fmtUsd(stats.marketCapUsd)} / ${target}`);
    setText(els.progress, `${fmtNum(pct, 2)}%`);
    if (els.progressBar) els.progressBar.style.width = `${pct}%`;
    setText(els.pendingStaking, fmtBNB(pendingStaking));
    setText(els.pendingBuyback, fmtBNB(pendingBuyback));
    setText(els.pendingLP, fmtBNB(pendingLP));
    setText(els.luckyVault, fmtBNB(luckyVault));
    setText(els.totalTax, fmtBNB(totalTax));
    setText(els.burned, fmtToken(stats.burnedTokenBalance, decimals, 0));
    setText(els.burnedUnit, symbol);
    setText(els.totalWeight, fmtToken(stats.totalStakingWeight, 18, 0));
    setText(els.totalStaked, fmtToken(stats.totalStakedAmount, decimals, 0));
    setText(els.totalStakedUnit, symbol);
    setText(els.stakerCount, String(stats.stakingUserCount));
  } catch (error) {
    console.error("loadOnchainData failed", error);
    setText(els.marketCap, "链上数据读取失败");
  }
}

buildStageTrack();
window.addEventListener("scroll", updateActiveNav);
updateActiveNav();
loadOnchainData();