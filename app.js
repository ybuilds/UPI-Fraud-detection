console.log("App Loaded ✅");

// ================= GLOBALS =================
let graph = {};
let inDegree = {};
let outDegree = {};
let index = 0;

let intervalId = null;
let isRunning = false;
let isPausedForCycle = false;

// 🔥 LIMITS FOR LARGE DATA
const MAX_NODES = 200;
const MAX_EDGES = 500;

// ================= CYTOSCAPE =================
let cy = cytoscape({
    container: document.getElementById('graph'),
    elements: [],
    style: [
        {
            selector: 'node',
            style: {
                'label': 'data(id)',
                'background-color': '#00e5ff'
            }
        },
        {
            selector: '.mule',
            style: {
                'background-color': '#ff1744',
                'width': 30,
                'height': 30
            }
        },
        {
            selector: 'edge',
            style: {
                'curve-style': 'bezier',
                'line-color': '#aaa',
                'target-arrow-shape': 'triangle'
            }
        },
        {
            selector: '.cycle',
            style: {
                'line-color': '#ffea00',
                'width': 4
            }
        }
    ],
    layout: { name: 'cose' }
});

// ================= CHART =================
let chart = new Chart(document.getElementById("fraudChart"), {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Fraud Score',
            data: []
        }]
    }
});

// ================= START =================
function startSimulation() {
    if (isRunning) return;

    isRunning = true;

    intervalId = setInterval(() => {

        if (isPausedForCycle) return;

        if (index >= transactions.length) {
            stopSimulation();
            return;
        }

        // 🔥 SMALL BATCH FOR CLARITY
        for (let i = 0; i < 2; i++) {
            if (index >= transactions.length) break;
            processTransaction(transactions[index++]);
        }

        cy.layout({ name: 'cose', animate: true }).run();

    }, 1000); // slower for visibility
}

// ================= STOP =================
function stopSimulation() {
    isRunning = false;

    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

// ================= RESET =================
function resetGraph() {
    stopSimulation();

    cy.elements().remove();
    graph = {};
    inDegree = {};
    outDegree = {};
    index = 0;

    document.getElementById("muleList").innerHTML = "";
    document.getElementById("cycleList").innerHTML = "";

    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.update();
}

// ================= PROCESS TX =================
function processTransaction(t) {

    t.from = String(t.from).trim();
    t.to = String(t.to).trim();

    // Add nodes
    if (!cy.getElementById(t.from).length) {
        cy.add({ data: { id: t.from } });
    }

    if (!cy.getElementById(t.to).length) {
        cy.add({ data: { id: t.to } });
    }

    // 🔥 LIMIT NODES
    if (cy.nodes().length > MAX_NODES) {
        cy.nodes()[0].remove();
    }

    // Add edge
    let edgeClass = t.fraud == 1 ? 'cycle' : '';

    cy.add({
        data: {
            id: 'e' + index,
            source: t.from,
            target: t.to
        },
        classes: edgeClass
    });

    // 🔥 LIMIT EDGES (SLIDING WINDOW)
    if (cy.edges().length > MAX_EDGES) {
        cy.edges()[0].remove();
    }

    // Graph structure
    if (!graph[t.from]) graph[t.from] = [];
    graph[t.from].push(t.to);

    outDegree[t.from] = (outDegree[t.from] || 0) + 1;
    inDegree[t.to] = (inDegree[t.to] || 0) + 1;

    detectMule();
    detectCycle();
}

// ================= FRAUD SCORE =================
function calculateFraudScore(user) {
    return Math.max((inDegree[user] * 2) - (outDegree[user] || 0), 0);
}

// ================= MULE DETECTION =================
function detectMule() {
    let muleList = document.getElementById("muleList");
    muleList.innerHTML = "";

    for (let user in inDegree) {
        let score = calculateFraudScore(user);

        if (score > 8) {
            cy.getElementById(user).addClass('mule');

            let li = document.createElement("li");
            li.innerText = `${user} (Score: ${score})`;
            muleList.appendChild(li);
        }
    }

    updateChart();
}

// ================= CHART UPDATE =================
function updateChart() {
    let users = Object.keys(inDegree);
    let scores = users.map(u => calculateFraudScore(u));

    chart.data.labels = users;
    chart.data.datasets[0].data = scores;
    chart.update();
}

// ================= CYCLE DETECTION =================
function detectCycle() {
    let visited = {};
    let stack = {};

    function dfs(node, path) {
        if (!graph[node]) return;

        visited[node] = true;
        stack[node] = true;
        path.push(node);

        for (let neighbor of graph[node]) {
            if (!visited[neighbor]) {
                dfs(neighbor, path);
            } else if (stack[neighbor]) {
                highlightCycle(path, neighbor);
            }
        }

        stack[node] = false;
        path.pop();
    }

    for (let node in graph) {
        if (!visited[node]) dfs(node, []);
    }
}

// ================= HIGHLIGHT CYCLE =================
function highlightCycle(path, startNode) {

    let cycleList = document.getElementById("cycleList");

    let cycle = [];
    let found = false;

    for (let n of path) {
        if (n === startNode) found = true;
        if (found) cycle.push(n);
    }

    cycle.push(startNode);

    if (cycle.length < 3) return;

    let li = document.createElement("li");
    li.innerText = "🚨 " + cycle.join(" → ");
    cycleList.appendChild(li);

    for (let i = 0; i < cycle.length - 1; i++) {

        let node = cy.getElementById(cycle[i]);
        node.addClass('mule');

        let edge = cy.edges().filter(e =>
            e.data('source') === cycle[i] &&
            e.data('target') === cycle[i + 1]
        );

        edge.addClass('cycle');
    }

    showAlert("🚨 Collusion Cycle Detected!");
    freezeSimulation();
}

// ================= FREEZE =================
function freezeSimulation() {
    if (isPausedForCycle) return;

    isPausedForCycle = true;

    setTimeout(() => {
        isPausedForCycle = false;
    }, 5000);
}

// ================= ALERT =================
function showAlert(msg) {
    let alertBox = document.getElementById("alertBox");
    if (!alertBox) return;

    alertBox.innerText = msg;
    alertBox.classList.remove("hidden");

    setTimeout(() => {
        alertBox.classList.add("hidden");
    }, 3000);
}

// ================= CSV LOAD =================
document.getElementById("fileInput").addEventListener("change", function(e) {

    let file = e.target.files[0];
    if (!file) return;

   Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true, // 🔥 helps parsing

    complete: function(results) {

        console.log("CSV Loaded:", results.data.length);
        console.log("Sample Row:", results.data[0]);

        transactions.length = 0;

        let maxRows = Math.min(10000, results.data.length);

        for (let i = 0; i < maxRows; i++) {

            let row = results.data[i];

            // 🔥 SAFELY ACCESS KEYS (handles bad parsing)
            let type = row.type || row[" type"] || "";

            if (type !== "TRANSFER" && type !== "CASH_OUT") continue;

            let from = row.nameOrig || row[" nameOrig"];
            let to = row.nameDest || row[" nameDest"];

            if (!from || !to) continue;

            from = String(from).trim();
            to = String(to).trim();

            if (from === to) continue;

            transactions.push({
                id: i,
                from: from,
                to: to,
                amount: parseFloat(row.amount || 0),
                fraud: row.isFraud || 0
            });
        }

        console.log("Processed:", transactions.length);

        if (transactions.length === 0) {
            alert("⚠️ Dataset format issue. Try CSV (comma-separated).");
            return;
        }

        resetGraph();
        startSimulation();
    }
});
});