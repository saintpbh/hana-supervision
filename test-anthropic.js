const { Anthropic } = require("@anthropic-ai/sdk");

const testModel = async (model) => {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 10,
      messages: [{ role: "user", content: "안녕" }]
    });
    console.log(model, "SUCCESS");
  } catch (err) {
    console.log(model, "ERROR:", err.message);
  }
};

const run = async () => {
  await testModel("claude-3-7-sonnet-20250219");
  await testModel("claude-3-7-sonnet-latest");
  await testModel("claude-3-5-sonnet-20241022");
};
run();
