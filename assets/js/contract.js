// Global variables
const TARGET_CHAIN_ID_HEX = "0x89"; // Polygon POS mainnet in hex
const RPC_URL_BLOCKCHAIN = "https://polygon-bor-rpc.publicnode.com";

const projectContractAddress = "0xC78E8E78829F8eC42070090016590300F2a3eA6e";

let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let contractAbi = null;
let wcProvider = null;
let timerIdBlocktime1 = null;
let timerIdBlocktime2 = null;
let recentBlockTime = 0;
let recentShadowFee = 0;
// multiple generate shadowId & percentBP pair automatically:
let finalShadowList = [];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_ID = "0x0000000000000000000000000000000000000000000000000000000000000000";

// DOM
const connectBtn = document.getElementById("connectWallet");
const navItems = document.querySelectorAll(".nav-item");
const nav2Items = document.querySelectorAll(".nav-item");
const contentArea = document.getElementById("contentArea");

// Get the input element
const bufferGasLimitInput = document.getElementById("buffergaslimit");

// Initialize global var from input's initial value (as you already do)
let bufferGasLimit = bufferGasLimitInput ? parseInt(bufferGasLimitInput.value) || 75000 : 75000;

const ERC20_ABI_OTHERS = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

// Listen for real-time changes
if (bufferGasLimitInput) {
  bufferGasLimitInput.addEventListener("input", function () {
    const value = parseInt(this.value);
    // Only update if it's a valid positive number
    if (!isNaN(value) && value > 0) {
      bufferGasLimit = value;
      // Optional: add visual feedback (e.g., green border)
      this.style.borderColor = "#2ecc71";
	  if (bufferGasLimit < 75000) {
		  this.style.borderColor = "#e74c3c";
	  }
    } else {
      // Optional: warn user or reset style
      this.style.borderColor = "#e74c3c";
	  bufferGasLimit = 75000; //default safe value
    }
  });
}

// Read ABI contract content from file
readAbiContractFile();

// manual connect wallet
connectBtn.addEventListener("click", connectWallet);

// Auto-connect on page load for first account
/*window.addEventListener("load", async () => {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        await initializeContract(accounts[0]);
        updateConnectButton(accounts[0]);
        //showTab("shadowgenerate");
      }
    } catch (err) {
      console.warn("Could not auto-connect wallet:", err);
    }
  }
});*/

async function readAbiContractFile() {
      try {
        // Fetch the file from the server
        const abiCfg = await fetch('contract.abi');
        // Check if the request was successful
        if (!abiCfg.ok) {
          throw new Error('Network response was not ok ' + abiCfg.statusText);
        }
        // Read the data from the response
		contractAbi = await abiCfg.text();
      } catch (error) {
        console.error('Error reading file:', error);
      }
}

// Correct evm network
async function ensureCorrectNetwork() {

  try {
    // Try switching first
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: TARGET_CHAIN_ID_HEX }],
    });
	return true;
  } catch (switchError) {
    // Chain not added to wallet
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: TARGET_CHAIN_ID_HEX,
            chainName: "Amoy Polygon Testnet",
            nativeCurrency: {
              name: "POL",
              symbol: "POL",
              decimals: 18,
            },
            rpcUrls: [RPC_URL_BLOCKCHAIN],
          },
        ],
      });
    } else {
	   alert(JSON.stringify(switchError, null, 2));
      throw switchError;
    }
	return false;
  }
}

// Wallet connection
async function connectWallet() {
  // If already connected → disconnect
  if (isConnected()) {
    userAddress = null;
    provider = null;
    signer = null;
    contract = null;
    updateConnectButton(null);
    contentArea.innerHTML =
      "<p>Wallet disconnected. Click 'Connect Wallet' to choose an account.</p>";
    return;
  }

  // Check if injected provider exists
  if (!window.ethereum) {
    const isMobile = /Android|iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isMobile) {
      contentArea.innerHTML = `
        <p>📱 <strong>Mobile user?</strong></p>
        <p>Please open this page in your wallet's in-app browser:</p>
        <ul style="text-align:left; display:inline-block;">
          <li>Open <strong>MetaMask</strong> → Browser → Enter this URL</li>
          <li>Or <strong>Trust Wallet</strong> → DApp Browser</li>
        </ul>
        <p>Desktop users: install MetaMask / Brave Wallet / Trust Wallet / eip1193.</p>
      `;
    } else {
      alert("Please install a standard wallet (MetaMask, Brave, Trust, eip1193).");
    }
    return;
  }

  try {
    // 1. Request accounts
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!accounts.length) throw new Error("No accounts returned");
	
    // 2. Ensure correct network chain id
    let chainxr = await ensureCorrectNetwork();
	
    // 3. Continue as before
    userAddress = accounts[0];
    await initializeContract(userAddress);
    updateConnectButton(userAddress);
    showTab("shadowgenerate");
  } catch (error) {
	alert('Connection error, please check network');
    console.error("Connection failed:", error);
    userAddress = null;
    provider = null;
    signer = null;
    contract = null;
    updateConnectButton(null);
    contentArea.innerHTML =
      "<p>Wallet connection rejected, failed, or wrong network.</p>";
  }
}

// Initialize ethers.js contract instance
async function initializeContract(address) {
  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();
  contract = new ethers.Contract(projectContractAddress, contractAbi, signer);
  userAddress = address;
}

// Update connect button text
function updateConnectButton(address) {
  if (address) {
    connectBtn.textContent = address.substring(0, 6) + "..." + address.substring(38) + "  (Logout)";
    connectBtn.style.background = "#2ecc71";
    connectBtn.disabled = false;
	scrollToItemId('mainmenu');
  } else {
    connectBtn.textContent = "Connect Wallet";
    connectBtn.style.background = "olive";
    connectBtn.disabled = false;
  }
}

// Check if wallet is connected
function isConnected() {
  return contract !== null && userAddress !== null;
}

// Attach click listeners to all nav items
navItems.forEach(item => {
  item.addEventListener("click", () => {
	const tab = item.getAttribute("data-tab");
	if (tab != "shadowgenerate") { // offline account generate only
		if (!isConnected()) {
		  alert("Please connect your wallet first!");
		  return;
		}
	}
    showTab(tab);
	scrollToContent();
  });
});

nav2Items.forEach(item => {
  item.addEventListener("click", () => {
	const tab = item.getAttribute("data-tab");
	if (tab != "shadowgenerate") { // offline account generate only
		if (!isConnected()) {
		  alert("Please connect your wallet first!");
		  return;
		}
	}
    showTab(tab);
	scrollToContent();
  });
});

// Render tab content
function showTab(tabName) {
	if (tabName != "shadowgenerate") { // offline account generate only
	  if (!isConnected()) {
		contentArea.innerHTML = "<p>Please connect your wallet.</p>";
		return;
	  }
	}

  let html = "";
  switch (tabName) {
    // === Shadow Tabs ===
    case "shadowgenerate":
		finalShadowList = [];
		let userAddressx;
		if (userAddress == null) {
			userAddressx = "";
		} else {
			userAddressx = userAddress;
		}
		
      html = `
        <fieldset style="display: block;margin-left: 4px;margin-right: 4px;padding-top: 4px;
			padding-bottom: 4px;padding-left: 4px;padding-right: 4px;">
		<legend style="font-size: 25px; font-weight: bold;">Personal Shadow ID - Generate</legend>
		<span style='color:gray;'>*Used for an anonymous receiver</span><br>
		<span style='color:olive;'>*Generate mechanism is totally offline & safe in your device</span><br>
		<span style='color:gray;'>*Unlimited new accounts can be generated by Auth phrases</span><br>
		<span style='color:olive;'>*Needed to have access to Owner wallet address for withdrawal later!</span><br>
		<span style='color:gray;'>*Do NOT forget 'Auth' phrases! it is NOT saved anywhere, no way to recover it!</span><br><br>
        <div class="form-group">
          <label>Owner wallet address</label>
		  <span style='color:gray;'>*shadow account is mapped to this address</span><br>
          <input type="text" id="genReceiver" placeholder="0x..." value="${userAddressx}" />
        </div>
        <div class="form-group">
          <label>Auth phrase (personal)</label>
          <input type="text" id="genAuth" placeholder="Set a strong Auth phrase(password)" />
        </div>
		<br><div id="genResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callShadowGenerate()">Generate</button>
		</fieldset>
      `;
	  html += `
		<br><br><br>
		<fieldset style="margin:4px;padding:12px;max-width:720px;">
		  <legend style="font-size:25px;font-weight:bold;">Shared Shadow ID - Generate</legend>
		  <span style='color:gray;'>*Used for multiple anonymous receivers</span><br>
		  <span style='color:olive;'>*Generate mechanism is totally offline & safe in your device</span><br>
		  <span style='color:gray;'>*A shared account is created from multiple personal shadow accounts</span><br>
		  <span style='color:olive;'>*All further deposits will be shared among the accounts according to each share percent</span><br>
		  <span style='color:gray;'>*Unlimited new accounts can be generated by Auth phrases</span><br>
		  <span style='color:olive;'>*Do NOT forget receivers list, or can NOT do distribution/withdrawal later!</span><br>
		  <span style='color:gray;'>*Do NOT forget 'Auth' phrases! it is NOT saved anywhere, no way to recover it!</span><br><br>
		  <!-- Auth -->
		  <div class="form-group">
			<label>Auth phrase (shared)</label>
			<input
			  id="shareAuth"
			  placeholder="Set a strong Auth phrase(password)"
			  style="width:100%;"
			/>
		  </div>
		  <fieldset style="margin:4px;padding:12px;max-width:720px;">
		  <p style="margin-bottom:10px;">
			Add owners(each ShadowId & it's share) manually or paste a full JSON array.
		  </p>
		  <!-- Manual Input -->
		  <div class="form-group">
			<label>ShadowId (0x + 64 hex chars)</label>
			<input
			  id="shadowIdInput"
			  placeholder="0x…"
			  style="width:100%;"
			/>
		  </div>
		  <div class="form-group">
			<label>Share (%)</label>
			<input
			  id="percentInput"
			  type="number"
			  min="0.000001"
			  max="100"
			  step="0.000001"
			  placeholder="e.g. 12.003501"
			  style="width:100%;"
			  value = "0.000001"
			/>
		  </div>
		  <button class="btn" onclick="addShareUX()" style="margin-top:6px;">
			Add to list
		  </button>
		  <!-- Inline Error -->
		  <div
			id="shareError"
			style="color:#c00;margin-top:8px;display:none;"
		  ></div>
		  <!-- Preview List -->
		  <div style="margin-top:16px;">
			<strong>Current List:</strong>
			<ul id="shareList" style="padding-left:20px;margin-top:6px;"></ul>
			<div
			  id="totalPercent"
			  style="margin-top:4px;font-size:14px;"
			></div>
		  </div>
		  <center><br><br><label style='color:#27ae60;'><b>OR</b></label><br><br></center>
		  <!-- JSON Input / Output -->
		  <div class="form-group" style="margin-top:14px;">
			<label>
			  List - Owners & Shares (JSON – editable)
			  <span style="font-weight:normal;font-size:13px;">
				— manual edit
			  </span>
			</label>
			<textarea
			  id="shareReceivers"
			  rows="5"
			  placeholder='[{"shadowId":"0x...","percentBP":500000000}]'
			  oninput="parseJsonInputUX()"
			  style="width:100%;"
			></textarea>
		  </div>
		 </fieldset><br>
		 <div id="shareGenResult" class="result" style="display:none;"></div><br>
		 <button class="btn" onclick="callShadowShareGenerate()">
			Generate
		 </button>
		</fieldset>
	  `
      break;

    case "shadowdeposit":
      html = `
        <h2>Deposit</h2>
		<span style='color:olive;'>*Deposit any ERC20 tokens or native POL coin to any shadow account</span><br>
		<span style='color:gray;'>*Deposits are fee-free (zero fee) for depositors</span><br>
		<span style='color:olive;'>*Each shadow account has an ID which is called Shadow ID (shadowId)</span><br>
		<span style='color:gray;'>*To deposit any ERC20 token you must set Asset address to its token address 0x...</span><br>
		<span style='color:olive;'>*To deposit native POL coin you must set Asset address to \'0x00\' </span><br>
		<span style='color:gray;'>*ShadowId owner (receiver) needs to pay SHADNA token as fee for withdrawal, so depositor may sponsor that fee</span><br>
		<span style='color:olive;'>*Ensure receiver shadowId is correct, no way to recover it!' </span><br><br>
        <div class="form-group">
          <label>Shadow ID (0x + 64 hex chars)</label>
          <input type="text" id="depShadowId" placeholder="0x..." />
        </div>
        <div class="form-group">
          <label>Asset address (0x... for ERC20 tokens, 0x00 for POL coin)</label>
          <input type="text" id="depToken" placeholder="0x00 or 0x..." />
        </div>
        <div class="form-group">
          <label>Amount (human-readable format)</label>
          <input type="text" id="depAmount" placeholder="e.g. 0.0000001" />
        </div>
        <div class="form-group">
          <label>Sponsor Fee?</label>
		  <span style='color:gray;'>*If choose Yes then you need to have SHADNA token in your wallet too</span><br>
          <select id="depSponsor">
            <option value="false">No (default)</option>
			<option value="true">Yes</option>
          </select>
        </div>
		<br><div id="depResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callShadowDeposit()">Deposit</button>
      `;
      break;

    case "shadowwithdraw":
      html = `
		<h2>Withdraw from Shadow account to wallet</h2>
		<span style='color:gray;'>*After withdrawal, the real wallet address is certainly visible for everyone!</span><br>
		<span style='color:olive;'>*To withdraw any ERC20 token you must set Asset address to its token address 0x...</span><br>
		<span style='color:gray;'>*To withdraw native POL coin you must set Asset address to \'0x00\' </span><br>
		<span style='color:olive;'>*Any withdrawal needed to pay fee via SHADNA token, so needed to have SHADNA token in wallet/shadow account</span><br><br>
        <div class="form-group">
          <label>Auth phrase</label>
          <input type="text" id="withAuth" placeholder="" />
        </div>
        <div class="form-group">
          <label>Asset address (0x... for ERC20 tokens, 0x00 for POL coin)</label>
          <input type="text" id="withAsset" placeholder="0x00 or token address" />
        </div>
        <div class="form-group">
          <label>Amount (human-readable format)</label>
          <input type="text" id="withAmount" placeholder="e.g. 0.0000001" />
        </div>
		<br><div id="withResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callShadowWithdraw()">Withdraw</button>
      `;
	  break;
	  
	case "shadowshare":
	  html = `
		<h2>Share(Distribute) asset to shadowIds</h2>
		  <span style='color:gray;'>*Distribute asset from shared account to it's rightful receivers</span><br>
		  <span style='color:olive;'>*The whole receivers is needed to authorize the distribution among them</span><br><br>
		  <!-- Asset -->
		  <div class="form-group">
			<label>Asset address (0x... for ERC20 tokens, 0x00 for POL coin)</label>
			<input
			  id="shareAsset"
			  placeholder="0x00 or 0x..."
			  style="width:100%;"
			/>
		  </div>
		  <!-- Auth -->
		  <div class="form-group">
			<label>Auth phrase (shared)</label>
			<input
			  id="shareAuth"
			  placeholder="Auth phrase"
			  style="width:100%;"
			/>
		  </div>
		  <fieldset style="display: block;margin-left: 4px;margin-right: 4px;padding-top: 4px;
			  padding-bottom: 4px;padding-left: 4px;padding-right: 4px;">
		  <p style="margin-bottom:10px;">
			Add owners(each ShadowId & it's share) manually or paste a full JSON array.
		  </p>
		  <!-- Manual Input -->
		  <div class="form-group">
			<label>ShadowId (0x + 64 hex chars)</label>
			<input
			  id="shadowIdInput"
			  placeholder="0x…"
			  style="width:100%;"
			/>
		  </div>
		  <div class="form-group">
			<label>Share (%)</label>
			<input
			  id="percentInput"
			  type="number"
			  min="0.000001"
			  max="100"
			  step="0.000001"
			  placeholder="e.g. 12.003501"
			  style="width:100%;"
			  value = "0.000001"
			/>
		  </div>
		  <button class="btn" onclick="addShareUX()" style="margin-top:6px;">
			Add to list
		  </button>
		  <!-- Inline Error -->
		  <div
			id="shareError"
			style="color:#c00;margin-top:8px;display:none;"
		  ></div>
		  <!-- Preview List -->
		  <div style="margin-top:16px;">
			<strong>Current List:</strong>
			<ul id="shareList" style="padding-left:20px;margin-top:6px;"></ul>
			<div
			  id="totalPercent"
			  style="margin-top:4px;font-size:14px;"
			></div>
		  </div>
		  <center><br><br><label style='color:#27ae60;'><b>OR</b></label><br><br></center>
		  <!-- JSON Input / Output -->
		  <div class="form-group" style="margin-top:14px;">
			<label>
			  List - Owners & Shares (JSON – editable)
			  <span style="font-weight:normal;font-size:13px;">
				— manual edit
			  </span>
			</label>
			<textarea
			  id="shareReceivers"
			  rows="5"
			  placeholder='[{"shadowId":"0x...","percentBP":500000000}]'
			  oninput="parseJsonInputUX()"
			  style="width:100%;"
			></textarea>
		  </div>
		  </fieldset><br>
		  <br><div id="shareDistResult" class="result" style="display:none;"></div><br>
		  <button class="btn" onclick="callShadowShare()">
			Distribute
		  </button>
	  `;
      break;
	  
	case "shadowproxy":
		  html = `
			<h2>Proxy - deposits forwarded to new shadowId from current shadowId account</h2>
			<span style='color:gray;'>*Any new incoming deposits will be forwarded automatically from current account</span><br>
			<span style='color:olive;'>*Disable proxy by setting new shadowId to \`0x00\` anytime</span><br>
			<span style='color:gray;'>*Change proxy just by setting new shadowId, anytime</span><br>
			<span style='color:olive;'>*Ensure you know Auth-phrase of NEW shadowId!</span><br><br>
			<div class="form-group">
			  <label>Current Shadow ID (0x + 64 hex chars)</label>
			  <input type="text" id="oldShadowId" placeholder="0x..." />
			</div>
			<div class="form-group">
			  <label>Current Auth phrase</label>
			  <input type="text" id="oldAuth" placeholder="Your current(old) auth" />
			</div>
			<div class="form-group">
			  <label>New Shadow ID (0x + 64 hex chars)</label>
			  <input type="text" id="newShadowId" placeholder="0x... for enable, or 0x00 for disable" />
			</div>
			<br><div id="proxyWithResult" class="result" style="display:none;"></div><br>
			<button class="btn" onclick="callShadowProxy()">Set Proxy</button>
		  `;
	  break;

    case "shadowfee":
	html = `
        <fieldset style="display: block;margin-left: 4px;margin-right: 4px;padding-top: 4px;
			  padding-bottom: 4px;padding-left: 4px;padding-right: 4px;">
		<legend style="font-size: 25px; font-weight: bold;">Current Shadow Fee</legend>
        <div class="form-group">
          <button class="btn" onclick="updateShadowFee()">View</button><br>
          <label>Fee Amount (human-readable format):</label>
		  <div id="feeStatusResult" class="result" style="display:none;"></div>
        </div>
		</fieldset>
      `;
      break;

    case "shadowstatus":
      html = `
        <fieldset style="display: block;margin-left: 4px;margin-right: 4px;padding-top: 4px;
			  padding-bottom: 4px;padding-left: 4px;padding-right: 4px;">
		<legend style="font-size: 25px; font-weight: bold;">Check Status</legend>
        <div class="form-group">
          <label>Shadow ID (0x + 64 hex chars)</label>
          <input type="text" id="checkShadowId" placeholder="0x..." />
        </div>
		<br><div id="checkResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callShadowSearchAccount()">Search</button>
		</fieldset>
      `;
	  html += `
		<br><br><br>
		<fieldset style="display: block;margin-left: 4px;margin-right: 4px;padding-top: 4px;
			  padding-bottom: 4px;padding-left: 4px;padding-right: 4px;">
		<legend style="font-size: 25px; font-weight: bold;">Check Assets</legend>
        <div class="form-group">
          <label>Shadow ID (0x + 64 hex chars)</label>
          <input type="text" id="searchShadowId" placeholder="0x..." />
        </div>
        <div class="form-group">
          <label>Asset address (0x... for ERC20 tokens, 0x00 for POL coin)</label>
          <input type="text" id="searchToken" placeholder="0x00 or 0x..." />
        </div>
		<br><div id="searchResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callShadowSearchAsset()">Search</button>
		</fieldset>
      `;
      break;

    // === Service Tabs ===
    case "servicefaucet":
      html = `
        <h2>Faucet</h2>
		
        <p>Claim tokens from faucet</p><br>
		
			<input type="radio" id="walletType" name="addrType" value="wallet" onclick="document.getElementById('faucetResult').style.display='block'; document.getElementById('shadowIdInput').style.display='none'; if(document.querySelector('input[name=addrType]:checked').value === 'wallet') {document.getElementById('faucetResult').textContent = 'Receiver: ${userAddress}';}">
			<label for="walletType">To wallet address</label><br><br>
		
			<input type="radio" id="shadowType" name="addrType" value="shadow" onclick="document.getElementById('faucetResult').style.display='block'; document.getElementById('shadowIdInput').style.display='block'; if(document.querySelector('input[name=addrType]:checked').value === 'shadow') {document.getElementById('faucetResult').textContent = 'Receiver: '+document.getElementById('shadowIdInput').value;}">
			<label for="shadowType">To shadow id</label><br>
			
			<div class="form-group">
			<!-- Hidden input field for shadow type -->
			<input type="text" id="shadowIdInput" name="shadowIdInput" placeholder="0x...(64 hex chars)" style="display:none;" onkeyup="document.getElementById('faucetResult').textContent = 'Receiver: '+document.getElementById('shadowIdInput').value;">
			</div>
			
		<div id="faucetResult" class="result" style="display:none;"></div><br>  
        <button class="btn" onclick="callFaucet()">Claim</button>
		
      `;
      break;

    /*case "serviceburn":
      html = `
        <h2>Burn Tokens</h2>
        <button class="btn" onclick="callBurnAll()">Burn All from Burn Pot</button>
        //<div id="burnResult" class="result" style="display:none;"></div>
     `;
      break;*/

    case "servicebuy":
      html = `
        <h2>Buy Tokens</h2>
        <div class="form-group">
		  <span style='color:gray;'>*Numbers are in human-readable format</span><br><br>
          <label>Pay amount in POL native coin</label>
          <input type="text" id="buyAssetIn" onInput="updateBuyTokensOut();" value="" placeholder="e.g. 0.0000001" />
        </div>
        <div class="form-group">
          <label>Get amount (SHADNA token)</label>
          <input type="text" id="buyTokensOut" placeholder="receive amount" readonly/>
        </div>
		<!--<input id="slippage" type="number" min="0.01" max="100" step="0.01" placeholder="e.g. 12.5" style="width:100%;" value="0.01" />-->
		<br><div id="buyResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callBuy()">Buy</button>
      `;
      break;

    case "miscbulktxwallet":
      html = `
        <h2>Multiple SHADNA Transfers from a wallet to wallets</h2>
        <div class="form-group">
          <label>Receiver Wallet Addresses (comma-separated)</label>
          <textarea id="bulkWalletReceivers" rows="3" placeholder="0x...,0x..."></textarea>
        </div>
        <div class="form-group">
          <label>Amount per Address (human-readable format)</label>
          <input type="text" id="bulkAmount" placeholder="e.g. 0.0000001" />
        </div>
		<br><div id="bulkWalletResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callBulkWalletTransfer()">Send</button>
      `;
      break;

	case "miscbulktxshadow":
      html = `
        <h2>Multiple Asset Transfers from a shadow to shadows</h2>
		<div class="form-group">
          <label>Auth phrase</label>
          <input type="text" id="authsh" placeholder="" />
        </div>
		<div class="form-group">
          <label>Asset address (0x... for ERC20 tokens, 0x00 for POL coin)</label>
          <input type="text" id="assetsh" placeholder="0x..." />
        </div>
		<div class="form-group">
          <label>Receiver Shadow Ids (comma-separated)</label>
          <textarea id="bulkShadowReceivers" rows="3" placeholder="0x...,0x..."></textarea>
        </div>
        <div class="form-group">
          <label>Amount per receiver (human-readable format)</label>
          <input type="text" id="bulkAmount" placeholder="e.g. 0.0000001" />
        </div>
		<br><div id="bulkShadowResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callBulkShadowTransfer()">Send</button>
      `;
      break;
	  
    // === Donate Tabs ===
    case "donateliq":
      html = `
        <h2>Donate to Liquidity Pool</h2>
        <div class="form-group">
          <label>Amount (human-readable format)</label>
          <input type="text" id="donateLpAmount" placeholder="e.g. 0.0000001" />
        </div>
		<br><div id="donateLpResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callDonateLP()">Donate</button>
      `;
      break;

    case "donatefaucet":
      html = `
        <h2>Donate to Faucet</h2>
        <div class="form-group">
          <label>Amount (human-readable format)</label>
          <input type="text" id="donateFaucetAmount" placeholder="e.g. 0.0000001" />
        </div>
		<br><div id="donateFaucetResult" class="result" style="display:none;"></div><br>
        <button class="btn" onclick="callDonateFaucet()">Donate</button>
      `;
      break;

    default:
      html = "<p>Select a tab.</p>";
  }

  contentArea.innerHTML = html;
}

if (timerIdBlocktime1 == null) {
	timerIdBlocktime1 = setInterval(() => {
		callUpdateBlocktime(false);
		}, 1001);
}
if (timerIdBlocktime2 == null) {
	timerIdBlocktime2 = setInterval(() => {
		callUpdateBlocktime(true);
		}, 10011);
}


// ============= Function Handlers =============

// Fixed salt as a 256-bit value
const _fixedsalt = ethers.BigNumber.from("99348817924976366371903841894776801826014358578820932237806716940464876084678");

// Account hash generator
function offlineGenerateSingleId(receiver, auth) {
    return ethers.utils.keccak256(ethers.utils.solidityPack(['uint256', 'address', 'string'], [_fixedsalt, receiver, auth]));
}

// Shared account hash generator from multiple receivers
function offlineGenerateShareId(receivers, auth) {
    if (receivers.length === 0) {
        throw new Error("input list of receivers must be a tuple of [[shadowId,percentBP],...]");
    }
    if (auth.trim() === "") {
        throw new Error("set a strong auth");
    }

    let xorAll = ethers.BigNumber.from(0);
    let ts = 0;

    for (let i = 0; i < receivers.length; i++) {
        const { shadowId, percentBP } = receivers[i];
        xorAll = xorAll.xor(ethers.BigNumber.from(ethers.utils.keccak256(ethers.utils.solidityPack(['bytes32', 'uint32'], [shadowId, percentBP]))));
        ts += percentBP;
    }
	
    if (ts !== 100000000) {
        throw new Error("sum of all percentBP must be equal to 100000000BP (means 100%)");
    }

    // Convert xorAll to a hex string and pad it to 64 bytes
    const xorAllHex = xorAll.toHexString().padStart(64, '0');

    return ethers.utils.keccak256(ethers.utils.solidityPack(['uint256', 'bytes32', 'string'], [_fixedsalt, xorAllHex, auth]));
}

async function getTransactionDetails() {
	const txId = document.getElementById("tempResult").value.trim();
  try {
    // Fetch the transaction receipt
    const receipt = await provider.getTransactionReceipt(txId);

    if (receipt) {
      console.log('Transaction Details:', receipt);
	  document.getElementById("tempResult").value = JSON.stringify(receipt, null, 2);;
    } else {
      console.error('Transaction not found.');
    }
  } catch (error) {
    console.error('Error retrieving transaction details:', error.message);
  }
}

// Shadow: Share Generate
async function callShadowShareGenerate() {
	  scrollToBottom();
  const receiversStr = document.getElementById("shareReceivers").value.trim();
  const auth = document.getElementById("shareAuth").value.trim();
  const resultDiv = document.getElementById("shareGenResult");
  const totalBP = finalShadowList.reduce((sum, s) => sum + s.percentBP, 0);
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  if (totalBP !== 100000000) {
    alert(showErrorUX(
      `Total share must be exactly 100%. ` +
      `Current total: ${(totalBP / 1000000).toFixed(6)}%.`
    ));
    return;
  }
  showErrorUX(""); // clear any previous warning
  try {
    const receivers = JSON.parse(receiversStr);
    if (!Array.isArray(receivers)) throw new Error("Receiver shadow ids must be an array");
	if (receivers.length == 1) {
		alert('Multiple receivers is needed, current: 1');
		resultDiv.style.display = "block";
		resultDiv.innerHTML = `<span style='color:red;'>Error: Multiple receivers is needed, current: 1</span>`;
		return;
	}
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Generating...";
	const shadowId = offlineGenerateShareId(receivers, auth);
	resultDiv.innerHTML = `<strong>Shadow ID(shadowId) account:</strong> <br><code onclick="copyIdToClipboard('${shadowId}')"><span style="text-decoration: underline; cursor: pointer;">${shadowId}</span></code>`;
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Shadow: Share 
async function callShadowShare() {
	  scrollToBottom();
  const receiversStr = document.getElementById("shareReceivers").value.trim();
  const auth = document.getElementById("shareAuth").value.trim();
  const asset = document.getElementById("shareAsset").value.trim();
  const resultDiv = document.getElementById("shareDistResult");
  const totalBP = finalShadowList.reduce((sum, s) => sum + s.percentBP, 0);
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  if (totalBP !== 100000000) {
    alert(showErrorUX(
      `Total share must be exactly 100%. ` +
      `Current total: ${(totalBP / 1000000).toFixed(6)}%.`
    ));
    return;
  }
  showErrorUX(""); // clear any previous warning
  let tokenAddr;
  if (asset === "0x00" || asset.toLowerCase() === "zero") {
	tokenAddr = ethers.constants.AddressZero;
  } else {
  try {
	tokenAddr = ethers.utils.getAddress(asset.toLowerCase());
  } catch (e) {
	resultDiv.style.display = "block";
	resultDiv.innerHTML = "<span style='color:red;'>Invalid asset(token) address!</span>";
	return;
  }
 }
  
  try {
    const receivers = JSON.parse(receiversStr);
    if (!Array.isArray(receivers)) throw new Error("Receivers must be an array");
	let estGasLimit = await contract.estimateGas.shadowShare(receivers, auth, tokenAddr);
	estGasLimit = estGasLimit.add(bufferGasLimit);
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Sharing to shadowIds...";
    const tx = await contract.shadowShare(receivers, auth, tokenAddr, { gasLimit: estGasLimit });
    resultDiv.innerHTML = `✅ Transaction: <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Shadow: Proxy
async function callShadowProxy() {
	  scrollToContent();
  const oldShadowId = document.getElementById("oldShadowId").value.trim();
  const oldAuth = document.getElementById("oldAuth").value.trim();
  let newShadowId = document.getElementById("newShadowId").value.trim();
  const resultDiv = document.getElementById("proxyWithResult");
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  if ((newShadowId == 'zero') || (newShadowId == '0x00')) { newShadowId = ZERO_ID;}
  try {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Proxy to new shadowId...";
	let estGasLimit = await contract.estimateGas.shadowSetProxy(oldShadowId, oldAuth, newShadowId, userAddress);
	estGasLimit = estGasLimit.add(bufferGasLimit);
    const tx = await contract.shadowSetProxy(oldShadowId, oldAuth, newShadowId, userAddress, { gasLimit: estGasLimit });
    resultDiv.innerHTML = `✅ Transaction: <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Shadow: Search Account
async function callShadowSearchAccount() {
	  scrollToContent();
  const shadowId = document.getElementById("checkShadowId").value.trim();
  const resultDiv = document.getElementById("checkResult");
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  if (!/^(0x[0-9a-fA-F]{64})$/.test(shadowId)) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid Shadow ID!</span>";
    return;
  }
  try {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Checking...";
    const [proxy, score, exists] = await contract.searchShadowAccount(shadowId);
	let actx = '', prox= '';
	if (exists == true) {actx = '[Active]';} else {actx = '[Inactive/Empty]';}
	if (proxy.toString() == ZERO_ID) {prox = '[Disabled]';} else {prox = proxy.toString();}
    resultDiv.innerHTML = `<strong>ShadowID:</strong> ${shadowId}<br><strong>Activity(history):</strong> ${actx}<br><strong>Proxy to:</strong> ${prox}<br><strong>Score:</strong> ${score.toString()}`;
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Shadow: Search Asset
async function callShadowSearchAsset() {
	  scrollToBottom();
  const shadowId = document.getElementById("searchShadowId").value.trim();
  const token = document.getElementById("searchToken").value.trim();
  const resultDiv = document.getElementById("searchResult");
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  if (!/^(0x[0-9a-fA-F]{64})$/.test(shadowId)) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input!</span>";
    return;
  }
  
  let tokenAddr;
  if (token === "0x00" || token.toLowerCase() === "zero") {
	tokenAddr = ethers.constants.AddressZero;
  } else {
  try {
	tokenAddr = ethers.utils.getAddress(token.toLowerCase());
  } catch (e) {
	resultDiv.style.display = "block";
	resultDiv.innerHTML = "<span style='color:red;'>Invalid asset(token) address!</span>";
	return;
  }
 }
  
  try {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Searching...";
    const asset = await contract.searchShadowAsset(shadowId, tokenAddr);
	let balance = convertFromWei(asset.balance, asset.decimal);
	if (balance === null) {
		resultDiv.style.display = "block";
		resultDiv.innerHTML = `<span style='color:red;'>Failed to fetch asset info</span>`;
	}
	
    resultDiv.innerHTML = `
	  <strong>ShadowID:</strong> ${shadowId}<br>
	  <strong>AssetAddress:</strong> ${tokenAddr}<br>
      <strong>Balance:</strong> ${balance}<br><br>
	  *Balance amount is in human-readable format*
    `;
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Service: Faucet
async function callFaucet() {
	  scrollToContent();
  const resultDiv = document.getElementById("faucetResult");
  let checkedRadio = document.querySelector('input[name="addrType"]:checked');
  if(!checkedRadio) {alert('choose a receiver');}
  let shadowId = document.getElementById("shadowIdInput").value.trim();
  let recvType = checkedRadio.value;
  
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  try {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Claiming from faucet...";
	let estGasLimit;
	let tx;
	if (recvType == "wallet") {
		estGasLimit = await contract.estimateGas.faucet();
		estGasLimit = estGasLimit.add(bufferGasLimit);
		tx = await contract.faucet({ gasLimit: estGasLimit });
    } else if (recvType == "shadow") {
		estGasLimit = await contract.estimateGas.faucetToShadow(shadowId);
		estGasLimit = estGasLimit.add(bufferGasLimit);
		tx = await contract.faucetToShadow(shadowId, { gasLimit: estGasLimit });
	} else {
		alert('undefined receiver type');
		return;
	}
	resultDiv.innerHTML = `✅ Transaction: <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Service: Burn All - optional
/*async function callBurnAll() {
	  scrollToContent();
  const resultDiv = document.getElementById("burnResult");
  try {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Burning...";
	let estGasLimit = await contract.estimateGas.burnPotAll();
	estGasLimit = estGasLimit.add(bufferGasLimit);
    const tx = await contract.burnPotAll({ gasLimit: estGasLimit });
    resultDiv.innerHTML = `✅ Transaction: <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}*/

async function updateBuyTokensOut() {
    let pricex = null;
    const resultDiv = document.getElementById("buyResult");
    try {
        pricex = await contract.priceOneFullToken();
        if ((pricex === false) || (pricex === null)) {
            resultDiv.style.display = "block";
            resultDiv.innerHTML = `<span style='color:red;'>Error: failed to fetch price from blockchain</span>`;
        }
    } catch (err) {
        resultDiv.style.display = "block";
        resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
    }
	if (!pricex.eq(ethers.constants.Zero)) {
    let assetAmountIn = document.getElementById("buyAssetIn").value.trim();
    let nativeDecimal = 18, ourDecimal = 18;
    // Convert the input amount to Wei
    let assetAmount = convertToWei(assetAmountIn, nativeDecimal);
    if (assetAmount === null) {
        return;
    }
    // Perform the calculation
    let amountIn = ethers.BigNumber.from(assetAmount);
    // Add a delay of 1000 milliseconds (1 second)
    await new Promise(resolve => setTimeout(resolve, 1000));
    let amountOut = amountIn.mul(ethers.constants.WeiPerEther).div(pricex);
    // Convert the result back to a human-readable format
    let humanAmount = ethers.utils.formatUnits(amountOut, ourDecimal);
    document.getElementById("buyTokensOut").value = humanAmount;
	} else {
		document.getElementById("buyTokensOut").value = "0.0";
	}
}

// Service: Buy
async function callBuy() {
	  scrollToContent();
  let assetAmountIn = document.getElementById("buyAssetIn").value.trim();
  let tokensAmountOut = "0";//document.getElementById("buyTokensOut").value.trim();
  const slippage = "0";//document.getElementById("slippage").value.trim();
  const resultDiv = document.getElementById("buyResult");
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  if (tokensAmountOut == "") {tokensAmountOut = "0";}
  if (assetAmountIn == "") {assetAmountIn = "0";}
  
  let nativeDecimal = 18, ourDecimal = 18;
  let assetAmount = convertToWei(assetAmountIn, nativeDecimal);
  if (assetAmount === null) {
	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input asset amount in!</span>";
	return;
  }
  let tokensAmount = convertToWei(tokensAmountOut, ourDecimal);
  if (tokensAmount === null) {
	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input tokens amount out!</span>";
	return;
  }
  
  try {
    const assetInBN = ethers.BigNumber.from(assetAmount);
    const tokensOutBN = ethers.BigNumber.from(tokensAmount);
    let slippageNum = Math.round(parseFloat(slippage) * 100);
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Buying...";
	let estGasLimit = await contract.estimateGas.buy(assetInBN, tokensOutBN, slippageNum, { value: assetInBN });
	estGasLimit = estGasLimit.add(bufferGasLimit);
	let tx = null;
	tx = await contract.buy(assetInBN, tokensOutBN, slippageNum, { value: assetInBN, gasLimit: estGasLimit });
    resultDiv.innerHTML = `✅ Transaction: <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Service: Bulk Wallet Transfer
async function callBulkWalletTransfer() {
	  scrollToContent();
  const receiversStr = document.getElementById("bulkWalletReceivers").value.trim();
  const amountx = document.getElementById("bulkAmount").value.trim();
  const resultDiv = document.getElementById("bulkWalletResult");
  resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  let receivers;
  try {
    receivers = receiversStr
      .split(',')
      .map(r => r.trim())
      .filter(r => r.length > 0)
      .map(r => ethers.utils.getAddress(r.toLowerCase())); // ✅ normalize + checksum
  } catch (e) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid address in receivers list!</span>";
    return;
  }

  if (receivers.length === 0) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>No valid receiver addresses!</span>";
    return;
  }
  
  const decimalx = 18;
  const amount = convertToWei(amountx, decimalx);
  if (amount === null) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input amount!</span>";
    return;
  }

  try {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Sending to wallets...";
	let estGasLimit = await contract.estimateGas.transferToManyWallets(receivers, amount, userAddress);
	estGasLimit = estGasLimit.add(bufferGasLimit);
    const tx = await contract.transferToManyWallets(receivers, amount, userAddress, { gasLimit: estGasLimit });

    resultDiv.innerHTML = `✅ Transaction: 
      <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;

    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Service: Bulk Shadow Transfer
async function callBulkShadowTransfer() {
	  scrollToContent();
  const receiversStr = document.getElementById("bulkShadowReceivers").value.trim();
  const amountx = document.getElementById("bulkAmount").value.trim();
  const auth = document.getElementById("authsh").value.trim();
  const asset = document.getElementById("assetsh").value.trim();
  const resultDiv = document.getElementById("bulkShadowResult");
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  let tokenAddr;
  if (asset === "0x00" || asset.toLowerCase() === "zero") {
	tokenAddr = ethers.constants.AddressZero;
  } else {
  try {
	tokenAddr = ethers.utils.getAddress(asset.toLowerCase());
  } catch (e) {
	resultDiv.style.display = "block";
	resultDiv.innerHTML = "<span style='color:red;'>Invalid asset(token) address!</span>";
	return;
  }
 }
  
  let decimalx = -1;
  if (tokenAddr == ethers.constants.AddressZero) {
	  decimalx = 18;
  } else {
	decimalx = await tokenDecimals(tokenAddr);
  }
  if (decimalx === null) {
  	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Failed to fetch asset decimals!</span>";
	return;
  }
  
  const amount = convertToWei(amountx, decimalx);
  if (amount === null) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input amount!</span>";
    return;
  }
  
  try {
    const receivers = receiversStr.split(',').map(r => r.trim()).filter(r => r);
    if (receivers.length === 0) throw new Error("No receivers");
    const amountBN = ethers.BigNumber.from(amount);
	  resultDiv.style.display = "block";
	  resultDiv.innerHTML = "...";
	let estGasLimit;
	let tx;
	if (tokenAddr != ethers.constants.AddressZero) {
		estGasLimit = await contract.estimateGas.transferToManyShadows(auth, receivers, tokenAddr, amountBN, userAddress);
		estGasLimit = estGasLimit.add(bufferGasLimit);
		tx = await contract.transferToManyShadows(auth, receivers, tokenAddr, amountBN, userAddress, { gasLimit: estGasLimit });
	} else {
		estGasLimit = await contract.estimateGas.transferToManyShadows(auth, receivers, tokenAddr, amountBN, userAddress, {value: amountBN});
		estGasLimit = estGasLimit.add(bufferGasLimit);
		tx = await contract.transferToManyShadows(auth, receivers, tokenAddr, amountBN, userAddress, { value: amountBN, gasLimit: estGasLimit });
	}
    resultDiv.innerHTML = `✅ Transaction: <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Donate: LP
async function callDonateLP() {
	  scrollToContent();
  const amountx = document.getElementById("donateLpAmount").value.trim();
  const resultDiv = document.getElementById("donateLpResult");
  
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  
  let ourDecimal = 18;
  let amount = convertToWei(amountx, ourDecimal);
  if (amount === null) {
	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input amount in!</span>";
	return;
  }
  
  try {
    const amountBN = ethers.BigNumber.from(amount);
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Donating...";
	let estGasLimit = await contract.estimateGas.donateToLP(amountBN, userAddress);
	estGasLimit = estGasLimit.add(bufferGasLimit);
    const tx = await contract.donateToLP(amountBN, userAddress, { gasLimit: estGasLimit });
    resultDiv.innerHTML = `✅ Transaction: <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Donate: Faucet
async function callDonateFaucet() {
	  scrollToContent();
  const amountx = document.getElementById("donateFaucetAmount").value.trim();
  const resultDiv = document.getElementById("donateFaucetResult");
  
    resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  
  let ourDecimal = 18;
  let amount = convertToWei(amountx, ourDecimal);
  if (amount === null) {
	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input amount in!</span>";
	return;
  }
  
  try {
    const amountBN = ethers.BigNumber.from(amount);
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Donating...";
	let estGasLimit = await contract.estimateGas.donateToFaucet(amountBN, userAddress);
	estGasLimit = estGasLimit.add(bufferGasLimit);
    const tx = await contract.donateToFaucet(amountBN, userAddress, { gasLimit: estGasLimit });
    resultDiv.innerHTML = `✅ Transaction: <a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason}</span>`;
  }
}

// Shadow: Generate id single
async function callShadowGenerate() {
	  //scrollToContent();
  const receiver = document.getElementById("genReceiver").value.trim();
  const auth = document.getElementById("genAuth").value.trim();
  const resultDiv = document.getElementById("genResult");

  resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";
  
  let recvAddr;
  if (receiver === "0x00" || receiver.toLowerCase() === "zero") {
	recvAddr = ethers.constants.AddressZero;
  } else {
  try {
	recvAddr = ethers.utils.getAddress(receiver.toLowerCase());
  } catch (e) {
	resultDiv.style.display = "block";
	resultDiv.innerHTML = "<span style='color:red;'>Invalid receiver address!</span>";
	return;
  }
 }

  try {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Generating...";
	const shadowId = offlineGenerateSingleId(recvAddr, auth);
	resultDiv.innerHTML = `<strong>Shadow ID(shadowId) account:</strong> <br><code onclick="copyIdToClipboard('${shadowId}')"><span style="text-decoration: underline; cursor: pointer;">${shadowId}</span></code>`;
  } catch (err) {
    console.error(err);
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason || err.toString()}</span>`;
  }
}

// Shadow: deposit
async function callShadowDeposit() {
	  scrollToBottom();
  const shadowId = document.getElementById("depShadowId").value.trim();
  const token = document.getElementById("depToken").value.trim();
  const amountx = document.getElementById("depAmount").value.trim();
  const sponsor = document.getElementById("depSponsor").value === "true";
  const resultDiv = document.getElementById("depResult");
  
  resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";

  if (!/^(0x[0-9a-fA-F]{64})$/.test(shadowId)) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Shadow ID must be 0x + 64 hex chars (32 bytes)!</span>";
    return;
  }

  let tokenAddr;
  if (token === "0x00" || token.toLowerCase() === "zero") {
	tokenAddr = ethers.constants.AddressZero;
  } else {
  try {
	tokenAddr = ethers.utils.getAddress(token.toLowerCase());
  } catch (e) {
	resultDiv.style.display = "block";
	resultDiv.innerHTML = "<span style='color:red;'>Invalid token address!</span>";
	return;
  }
 }
  
  let decimalx = -1;
  if (tokenAddr == ethers.constants.AddressZero) {
	  decimalx = 18;
  } else {
	decimalx = await tokenDecimals(tokenAddr);
  }
  if (decimalx === null) {
  	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Failed to fetch token decimals! Asset address is wrong?</span>";
	return;
  }
  let amount = convertToWei(amountx, decimalx);
  if (amount === null) {
	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input amount!</span>";
	return;
  }

  let amountBN;
  try {
    amountBN = ethers.BigNumber.from(amount);
  } catch (e) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid amount format!</span>";
    return;
  }

  try {
	if ((tokenAddr != "0x00") && (tokenAddr != ZERO_ADDRESS) && (tokenAddr != "zero") && (tokenAddr.toLowerCase() != projectContractAddress.toLowerCase())) {
		let approveOk = await approveIfNeeded(tokenAddr, projectContractAddress, amountBN, signer);
		if (approveOk == false) {
			console.error('approve token is failed');
			resultDiv.style.display = "block";
			resultDiv.innerHTML = `<span style='color:red;'>Error: approve token is failed</span>`;
			return;
		}
	}
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Sending transaction...";
    let tx = null;
	let estGasLimit = null;
    if (tokenAddr === ethers.constants.AddressZero) {
	  estGasLimit = await contract.estimateGas.shadowDeposit(shadowId, tokenAddr, amountBN, sponsor, userAddress, {value: amountBN});
	  estGasLimit = estGasLimit.add(bufferGasLimit);
      tx = await contract.shadowDeposit(shadowId, tokenAddr, amountBN, sponsor, userAddress, {value: amountBN, gasLimit: estGasLimit});
    } else {
	  estGasLimit = await contract.estimateGas.shadowDeposit(shadowId, tokenAddr, amountBN, sponsor, userAddress);
	  estGasLimit = estGasLimit.add(bufferGasLimit);
      tx = await contract.shadowDeposit(shadowId, tokenAddr, amountBN, sponsor, userAddress, {gasLimit: estGasLimit});
    }
    resultDiv.innerHTML = `⏳ Transaction sent:<br><a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    console.error(err);
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason || err.toString()}</span>`;
  }
}

// Shadow: withdraw - single
async function callShadowWithdraw() {
	  scrollToContent();
  const auth = document.getElementById("withAuth").value.trim();
  const asset = document.getElementById("withAsset").value.trim();
  const amountx = document.getElementById("withAmount").value.trim();
  const resultDiv = document.getElementById("withResult");
  
  resultDiv.style.display = "block";
  resultDiv.innerHTML = "...";

  let tokenAddr;
  if (asset === "0x00" || asset.toLowerCase() === "zero") {
	tokenAddr = ethers.constants.AddressZero;
  } else {
  try {
	tokenAddr = ethers.utils.getAddress(asset.toLowerCase());
  } catch (e) {
	resultDiv.style.display = "block";
	resultDiv.innerHTML = "<span style='color:red;'>Invalid asset(token) address!</span>";
	return;
  }
 }
  
  let decimalx = -1;
  if (tokenAddr == ethers.constants.AddressZero) {
	  decimalx = 18;
  } else {
	decimalx = await tokenDecimals(tokenAddr);
  }
  if (decimalx === null) {
  	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Failed to fetch asset(token) decimals!</span>";
	return;
  }
  let amount = convertToWei(amountx, decimalx);
  if (amount === null) {
	resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid input amount!</span>";
	return;
  }

  let amountBN;
  try {
    amountBN = ethers.BigNumber.from(amount);
  } catch (e) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;'>Invalid amount!</span>";
    return;
  }

  try {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "Sending withdrawal...";
	let estGasLimit = await contract.estimateGas.shadowWithdraw(auth, tokenAddr, amountBN, userAddress);
	estGasLimit = estGasLimit.add(bufferGasLimit);
    const tx = await contract.shadowWithdraw(auth, tokenAddr, amountBN, userAddress, { gasLimit: estGasLimit });
    resultDiv.innerHTML = `⏳ Transaction sent:<br><a href="https://amoy.polygonscan.com/tx/${tx.hash}" target="_blank">${tx.hash}</a>`;
    await tx.wait();
    resultDiv.innerHTML += "<br>✅ Confirmed!";
  } catch (err) {
    console.error(err);
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `<span style='color:red;'>Error: ${err.reason || err.toString()}</span>`;
  }
}

// refresh block time from chain
async function callUpdateBlocktime(fetchit) {
  try {
	if ((recentBlockTime === 0) || (fetchit == true)) {
        // fetch the block details
        let blockx = await provider.getBlock();
        // extract the timestamp from the block and use BigInt for precision
        recentBlockTime = blockx.timestamp;
		if ((recentBlockTime === 0) || (blockx == null)) {
			document.getElementById("uxtime").value = "[no connection]";
			return;
		}
	}
	
	recentBlockTime++;
	document.getElementById("uxtime").value = recentBlockTime;
	document.getElementById("uxtime").innerHTML = recentBlockTime;

  } catch (err) {
  }
}

async function updateShadowFee() {
	  scrollToContent();
	const resultDiv = document.getElementById("feeStatusResult");
	
	try {
		recentShadowFee = await contract.shadowFee();
		let ourDecimal = 18;
		humanAmount = ethers.utils.formatUnits(recentShadowFee, ourDecimal);
		if (humanAmount != null) {
			resultDiv.style.display = "block";
			resultDiv.innerHTML = "Current Withdrawal Fee: " + humanAmount;
		}
	} catch (err) {
			resultDiv.style.display = "block";
			resultDiv.innerHTML = "Failed to fetch current Shadow Fee from blockchain";
	}
}

async function approveIfNeeded(tokenAddress, spender, weiAmount, signerx) {
  try {
    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI_OTHERS, signerx);
    const owner = await signerx.getAddress();

    // Ensure weiAmount is a BigNumber
    const amount = ethers.BigNumber.isBigNumber(weiAmount)
      ? weiAmount
      : ethers.BigNumber.from(weiAmount);

    const currentAllowance = await erc20.allowance(owner, spender);

    // Already approved enough
    if (currentAllowance.gte(amount)) return true;
	
	let estGasLimit = await erc20.estimateGas.approve(spender, amount);
	estGasLimit = estGasLimit.add(bufferGasLimit);

    // Send approve tx
    const tx = await erc20.approve(spender, amount, {gasLimit: estGasLimit});
    await tx.wait(); // wait for confirmation

    return true; // approval succeeded
  } catch (err) {
    console.error("Approve failed:", err);
    return false; // any error → treat as failed
  }
}

//convert normal to wei
function convertToWei(amount, decimals) {
	try {
		return ethers.utils.parseUnits(amount.toString(), decimals);
	} catch (err) {
	return null;
	}
}

function convertFromWei(amount, decimals) {
    try {
        const value = ethers.utils.formatUnits(amount.toString(), decimals);
        // Remove trailing zeros but keep normal decimals
        return value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
    } catch (err) {
        console.error(err);
        return null;
    }
}

// get decimals of a token
async function tokenDecimals(tokenAddress) {
  try {
    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI_OTHERS, signer);
    const decimalVal = Number(await erc20.decimals());
    return decimalVal;
  } catch (err) {
    console.error("getting token decimals failed", err);
    return null;
  }
}

  /* ---------- Validation ---------- */

  function isValidBytes32(v) {
    return /^0x[a-fA-F0-9]{64}$/.test(v);
  }

  function showErrorUX(msg) {
    const el = document.getElementById("shareError");
    el.innerText = msg;
    el.style.display = msg ? "block" : "none";
	return msg;
  }

  /* ---------- Manual Add ---------- */

  function addShareUX() {
    showErrorUX("");

    const shadowId = document.getElementById("shadowIdInput").value.trim();
    const percent = parseFloat(document.getElementById("percentInput").value);

    if (!isValidBytes32(shadowId)) {
      return showErrorUX("Invalid shadowId (must be bytes32 hex).");
    }

    if (isNaN(percent) || percent < 0.000001 || percent > 100) {
      return showErrorUX("Percent must be between 0.000001 and 100.");
    }

    const percentBP = Math.round(percent * 1000000);

    const totalBP =
      finalShadowList.reduce((s, e) => s + e.percentBP, 0) + percentBP;

    if (totalBP > 100000000) {
      return showErrorUX("Total share cannot exceed 100%.");
    }

    finalShadowList.push({ shadowId, percentBP });
    updateUIUX();
    clearInputsUX();
  }

  function clearInputsUX() {
    document.getElementById("shadowIdInput").value = "";
    document.getElementById("percentInput").value = "";
  }

  /* ---------- Remove ---------- */

  function removeShareUX(index) {
    finalShadowList.splice(index, 1);
    updateUIUX();
  }

  /* ---------- JSON Paste / Edit ---------- */
  function parseJsonInputUX(justValidate = false) {
  showErrorUX("");

  const text = document.getElementById("shareReceivers").value.trim();
  if (!text) {
    finalShadowList = [];
    updateUIUX(false);
    return;
  }

  try {
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      return showErrorUX("JSON must be an array.");
    }

    let totalBP = 0;
    const normalized = [];

    for (const e of parsed) {
      if (!e || typeof e !== "object") {
        return showErrorUX("Invalid entry format in JSON.");
      }

      const shadowId = String(e.shadowId || "").trim();
      const percentBP = Number(e.percentBP);

      if (!isValidBytes32(shadowId)) {
        return showErrorUX("Invalid shadowId in JSON.");
      }

      if (!Number.isInteger(percentBP) || percentBP < 1 || percentBP > 100000000) {
        return showErrorUX("percentBP must be an integer between 1 and 100000000.");
      }

      totalBP += percentBP;
      normalized.push({ shadowId, percentBP });
    }

    finalShadowList = normalized;
	if (justValidate == false) {
		updateUIUX(false);
	}
  } catch {
    showErrorUX("Invalid JSON.");
  }
}

  /* ---------- UI Sync ---------- */

  function updateUIUX(syncTextarea = true) {
    const list = document.getElementById("shareList");
    const totalEl = document.getElementById("totalPercent");

    list.innerHTML = "";

    let totalBP = 0;

    finalShadowList.forEach((s, i) => {
      totalBP += s.percentBP;

      const li = document.createElement("li");
      li.innerHTML = `
        <code>${s.shadowId}</code>
        — ${(s.percentBP / 1000000).toFixed(6)}%
        <button onclick="removeShareUX(${i})" style="margin-left:6px;">✕</button>
      `;
      list.appendChild(li);
    });

    totalEl.innerText = `Total: ${(totalBP / 1000000).toFixed(6)}%`;

    if (syncTextarea) {
      document.getElementById("shareReceivers").value =
        JSON.stringify(finalShadowList, null, 6);
    }
	
	if (totalBP > 100000000) {
      return showErrorUX("Total percent exceeds 100%.");
    }
	
  }
///

function scrollToBottom() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth" // can be removed if needed
  });
}

function scrollToContent() {
  const contentElement = document.getElementById('contentArea');
  
  if (contentElement) {
    contentElement.scrollIntoView({
      behavior: "smooth",
      block: 'start',
      inline: 'nearest'
    });
  } else {
    console.error('Element with id="contentArea" not found');
  }
}

function scrollToItemId(itemIdStr) {
  const contentElement = document.getElementById(itemIdStr);
  
  if (contentElement) {
    contentElement.scrollIntoView({
      behavior: "smooth",
      block: 'start',
      inline: 'nearest'
    });
  } else {
    console.error('Element with id="contentArea" not found');
  }
}

function copyIdToClipboard(text) {
	navigator.clipboard.writeText(text).then(() => {
		alert('copied');
	}).catch(err => {
		console.error('Failed to copy: ', err);
		alert('Copy failed. Please press Ctrl+C or Command+C and paste.');
	});
}
