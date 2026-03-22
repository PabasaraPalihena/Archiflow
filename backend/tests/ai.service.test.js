const aiService = require("../models/ai/ai.service");
const openaiProvider = require("../models/ai/providers/openai.provider");

// The OpenAI provider was completely mocked with jest.mock(), 
// meaning that no actual API calls or keys are necessary.
jest.mock("../models/ai/providers/openai.provider");

// Lightweight helper functions
const node = (id, type) => ({ id, type, name: `${type}_${id}` });
const edge = (type, from, to) => ({ type, from, to });

describe("Feature: AI Integration Testing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("14.10.1 Key Validation Areas Covered", () => {

    it("TC-AI-01: Text -> Diagram", async () => {
      // Feature: Text -> Diagram
      // Validation Details: Mock returns a WAM-valid diagram JSON.
      // Expected Result: validation.valid = true; reply confirms successful validation.
      const mockValidDiagram = {
        diagram: {
          nodes: [
            node("r1", "Realm"),
            node("svc1", "Service")
          ],
          edges: [
            edge("Contains", "r1", "svc1")
          ]
        }
      };

      openaiProvider.generateDiagram.mockResolvedValue({
        text: JSON.stringify(mockValidDiagram),
        model: "gpt-mock"
      });

      const messages = [{ role: "user", content: "Create a simple service inside a realm" }];
      const result = await aiService.chat(messages);

      expect(openaiProvider.generateDiagram).toHaveBeenCalledTimes(1);
      expect(result.validation.valid).toBe(true);
      expect(result.reply).toContain("valid"); // "✅ Great! Your diagram is valid and ready to use."
    });

    it("TC-AI-02: Image -> Second Pass", async () => {
      // Feature: Image -> Second Pass
      // Validation Details: First image extraction returns nodes but no edges; 
      // second pass triggered automatically.
      // Expected Result: Second API call executed; final diagram validated successfully.
      
      const mockFirstPassDiagram = {
        diagram: {
          nodes: [
            node("r1", "Realm"),
            node("app1", "Application"),
            node("svc1", "Service")
          ],
          // No interaction edges (no Invocation/Legacy/Trust) to trigger second pass
          edges: [
            edge("Contains", "r1", "app1"),
            edge("Contains", "r1", "svc1")
          ] 
        }
      };

      const mockSecondPassDiagram = {
        diagram: {
          nodes: [
            node("r1", "Realm"),
            node("app1", "Application"),
            node("svc1", "Service")
          ],
          edges: [
            edge("Contains", "r1", "app1"),
            edge("Contains", "r1", "svc1"),
            edge("Invocation", "app1", "svc1") // Now interaction edges exist
          ]
        }
      };

      openaiProvider.generateDiagramFromImage
        .mockResolvedValueOnce({ text: JSON.stringify(mockFirstPassDiagram), model: "gpt-mock" })
        .mockResolvedValueOnce({ text: JSON.stringify(mockSecondPassDiagram), model: "gpt-mock" });

      const result = await aiService.imageToDiagram("data:image/png;base64,FAKE");

      // Verify second API call was executed
      expect(openaiProvider.generateDiagramFromImage).toHaveBeenCalledTimes(2);
      expect(result.validation.valid).toBe(true);
    });

    it("TC-AI-03: Diagram Repair", async () => {
      // Feature: Diagram Repair
      // Validation Details: Mock returns a corrected diagram after repair request.
      // Expected Result: validation.valid = true; reply confirms successful validation.
      
      const mockRepairedDiagram = {
        diagram: {
          nodes: [
            node("r1", "Realm"),
            node("app1", "Application"),
            node("svc1", "Service")
          ],
          edges: [
            edge("Contains", "r1", "app1"),
            edge("Contains", "r1", "svc1"),
            edge("Invocation", "app1", "svc1") // Properly repaired arrow
          ]
        }
      };

      openaiProvider.repairDiagram.mockResolvedValue({
        text: JSON.stringify(mockRepairedDiagram),
        model: "gpt-mock"
      });

      const mockErrors = ["Invocation must be Application -> Service..."];
      const result = await aiService.repair("Fix it", {}, mockErrors);

      expect(openaiProvider.repairDiagram).toHaveBeenCalledTimes(1);
      expect(result.validation.valid).toBe(true);
      expect(result.reply).toContain("fixed"); // "✅ I fixed the diagram to satisfy WAM rules."
    });

  });
});
