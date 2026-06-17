const { spawnSync } = require("child_process");

function runTests() {
  const result = spawnSync("php", ["vendor/bin/phpunit"], {
    cwd: "../project-ref",
    encoding: "utf-8"
  });

  if (result.status === 0) {
    console.log("? Testes passaram");
    return { success: true, output: result.stdout };
  }

  console.log("? Testes falharam");

  return {
    success: false,
    output: `
--- STDOUT ---
${result.stdout}

--- STDERR ---
${result.stderr}
`
  };
}

module.exports = { runTests };