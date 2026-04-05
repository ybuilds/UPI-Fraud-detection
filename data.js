const transactions = [];

const users = Array.from({ length: 50 }, (_, i) => "U" + (i + 1));

for (let i = 0; i < 1000; i++) {
    let sender = users[Math.floor(Math.random() * users.length)];
    let receiver = users[Math.floor(Math.random() * users.length)];

    if (sender === receiver) continue;

    transactions.push({
        id: i,
        from: sender,
        to: receiver,
        amount: Math.floor(Math.random() * 5000)
    });
}

// Inject collusion cycle
transactions.push({from:"U1", to:"U2"});
transactions.push({from:"U2", to:"U3"});
transactions.push({from:"U3", to:"U1"});