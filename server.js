const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bodyParser = require("body-parser");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const hesaplarDosyasi = path.join(__dirname, "public/account.json");
const sohbetDosyasi = path.join(__dirname, "public/chat.json");

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/pages/index.html"));
});

// Kayıt olma
app.post("/register", (req, res) => {
  const { email, password } = req.body;
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  let hesaplar = [];
  if (fs.existsSync(hesaplarDosyasi)) {
    hesaplar = JSON.parse(fs.readFileSync(hesaplarDosyasi));
  }
  if (hesaplar.find(h => h.email === email)) {
    return res.status(400).send("Bu e-posta zaten kayıtlı");
  }
  hesaplar.push({ email, password: hash });
  fs.writeFileSync(hesaplarDosyasi, JSON.stringify(hesaplar, null, 2));
  res.send("Kayıt başarılı");
});

// Giriş yapma
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  let hesaplar = [];
  if (fs.existsSync(hesaplarDosyasi)) {
    hesaplar = JSON.parse(fs.readFileSync(hesaplarDosyasi));
  }
  const bulunan = hesaplar.find(h => h.email === email && h.password === hash);
  if (bulunan) {
    res.send("Giriş başarılı");
  } else {
    res.status(401).send("Geçersiz kullanıcı adı veya şifre");
  }
});

// Yönetim paneli: sohbet mesajlarını görüntüle ve sil
app.get("/check/:password", (req, res) => {
  if (req.params.password !== process.env.PASSWORD) {
    return res.status(403).send("Erişim reddedildi");
  }
  const sohbetGeçmişi = fs.existsSync(sohbetDosyasi) ? JSON.parse(fs.readFileSync(sohbetDosyasi)) : [];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sohbet Kayıtları</title>
      <style>
        body { background: black; color: #0f0; font-family: monospace; padding: 20px; }
        button { float: right; color: red; background: transparent; border: 1px solid red; }
      </style>
    </head>
    <body>
      <h1>🧠 Sohbet Kayıtları</h1>
      <ul>
        ${sohbetGeçmişi.map((entry, index) => `
          <li>${entry.user}: ${entry.message} <form method="POST" action="/delete/${index}" style="display:inline;"><button type="submit">Sil</button></form></li>
        `).join('')}
      </ul>
    </body>
    </html>
  `;

  res.send(html);
});

// Sohbet mesajı silme
app.post("/delete/:index", (req, res) => {
  const index = parseInt(req.params.index);
  if (!fs.existsSync(sohbetDosyasi)) return res.redirect("/");
  let sohbetGeçmişi = JSON.parse(fs.readFileSync(sohbetDosyasi));
  if (index >= 0 && index < sohbetGeçmişi.length) {
    sohbetGeçmişi.splice(index, 1);
    fs.writeFileSync(sohbetDosyasi, JSON.stringify(sohbetGeçmişi, null, 2));
  }
  res.redirect(`/check/${process.env.PASSWORD}`);
});

io.on("connection", (socket) => {
  console.log("💻 Bir kullanıcı sohbet odasına katıldı");

  if (fs.existsSync(sohbetDosyasi)) {
    const sohbetGeçmişi = JSON.parse(fs.readFileSync(sohbetDosyasi));
    sohbetGeçmişi.forEach(({ user, message }) => {
      socket.emit("chat message", `${user}: ${message}`);
    });
  }

  socket.on("chat message", ({ user, message }) => {
    const entry = `${user}: ${message}`;
    io.emit("chat message", entry);

    let sohbetGeçmişi = [];
    if (fs.existsSync(sohbetDosyasi)) {
      sohbetGeçmişi = JSON.parse(fs.readFileSync(sohbetDosyasi));
    }
    sohbetGeçmişi.push({ user, message });
    fs.writeFileSync(sohbetDosyasi, JSON.stringify(sohbetGeçmişi, null, 2));
  });

  socket.on("disconnect", () => {
    console.log("🛑 Bir kullanıcı sohbet odasından ayrıldı");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Hacker Sohbet Odası ${PORT} portunda dinliyor`);
});