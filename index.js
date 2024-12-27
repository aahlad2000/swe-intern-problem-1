const fs = require("fs");
const os = require("os");
const express = require("express");
const db = require("better-sqlite3");
const cron = require("node-cron");

const database = new db("history.db");

database
  .prepare(
    `
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command TEXT NOT NULL
    )
`
  )
  .run();

const historyPath = `${os.homedir()}/.zsh_history`;
const app = express();
const port = 8080;

function fetchAllHistory() {
  try {
    const historyData = fs.readFileSync(historyPath, "utf-8");
    const historyList = historyData
      .split("\n")
      .map((line) => line.replace(/: \d+;/, "").trim())
      .filter((line) => line.length > 0);
    return historyList;
  } catch (error) {
    console.error("Error reading history", error);
    return [];
  }
}

function fetchAllCommands() {
  try {
    const select = database.prepare("SELECT * FROM history");
    const commands = select.all();
    return commands;
  } catch (error) {
    console.error("Error fetching data from DB", error);
    return [];
  }
}

function fetchByKeyword(keyword) {
  const allCommands = fetchAllCommands();
  const filteredCommands = allCommands.filter((command) =>
    command.startsWith(keyword)
  );
  return filteredCommands;
}

function saveAllHistory() {
  try {
    const deleteAllCommands = database.prepare("DELETE FROM history");
    deleteAllCommands.run();
    const insert = database.prepare("INSERT INTO history (command) VALUES (?)");
    const insertMany = database.transaction((commands) => {
      for (const command of commands) {
        insert.run(command);
      }
    });
    const allCommands = fetchAllHistory();
    insertMany(allCommands);
  } catch (error) {
    console.error("Error storing all commands to history table:", error);
  }
}

function deleteZshHistory() {
  const homeDir = os.homedir();
  const historyFilePath = path.join(homeDir, ".zsh_history");

  fs.unlink(historyFilePath, (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        console.log("No .zsh_history file found.");
      } else {
        console.error("Error deleting .zsh_history:", err.message);
      }
    } else {
      console.log(".zsh_history file deleted successfully.");
    }
  });
}

function writeAllCommandsToHistory() {
  const commands = fetchAllCommands();

  if (commands.length === 0) {
    console.log("No commands to write.");
    return;
  }

  const homeDir = os.homedir();
  const historyFilePath = path.join(homeDir, ".zsh_history");

  const timestamp = Math.floor(Date.now() / 1000);
  deleteZshHistory();
  commands.forEach((command) => {
    const zshFormattedCommand = `: ${timestamp}:0;${command}\n`;
    fs.appendFile(historyFilePath, zshFormattedCommand, (err) => {
      if (err) {
        console.error("Error writing to .zsh_history:", err.message);
      } else {
        console.log(
          `Command "${command}" written to .zsh_history successfully.`
        );
      }
    });
  });
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

//To fetch all the commands
app.get("/api/v1/allCommands", (req, res) => {
  const allCommands = fetchAllCommands();
  res.json({ success: true, data: allCommands });
});

//To fetch by keyword
app.get("/api/v1/commands", (req, res) => {
  const commands = fetchByKeyword(req);
  res.json({ success: true, data: commands });
});

//To clean up history and insert all the history table
app.post("/api/v1/saveAllHistory", (req, res) => {
  saveAllHistory();
  res.json({ success: true, message: "History imported into the database." });
});

app.post("/api/v1/writeAllCommands", (req, res) => {
  writeAllCommandsToHistory();
  res.json({
    success: true,
    message: "Completed writing commands to .zsh_history",
  });
});

//Cron job to run every minute to write to history
cron.schedule("* * * * *", saveAllHistory);
