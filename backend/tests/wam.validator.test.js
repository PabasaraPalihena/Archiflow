const { validateDiagram } = require("../models/wam/wam.validator");

// Lightweight helper functions
const node = (id, type) => ({ id, type, name: `${type}_${id}` });
const edge = (type, from, to) => ({ type, from, to });

describe("Feature: WAM Rule based Validation", () => {
  describe("14.9.1 Key Validation Areas Covered", () => {

    it("TC-WAM-01: Containment Rule", () => {
      // Validation Details: A non-Realm node submitted with no Contains edge from a Realm.
      // Expected Result: Returns valid: false with error referencing the uncontained element.
      const diagram = {
        nodes: [
          node("r1", "Realm"),
          node("s1", "Service")
          // deliberately omitting Contains edge from r1 to s1
        ],
        edges: []
      };
      
      const result = validateDiagram(diagram);
      expect(result.valid).toBe(false);
      
      const hasContainmentError = result.errors.some(err => 
        err.includes("must be contained") && err.includes("Service_s1")
      );
      expect(hasContainmentError).toBe(true);
    });

    it("TC-WAM-02: Edge Semantics", () => {
      // Validation Details: Invocation targeting a DataProvider instead of a Service; 
      // Legacy sourced from a DataProvider instead of an Application or Service; 
      // Trust issued between a Service and a Realm instead of two Realms.
      // Expected Result: Returns valid: false for each violation; errors identify the incorrect source/target.
      const diagram = {
        nodes: [
          node("r1", "Realm"),
          node("r2", "Realm"),
          node("app1", "Application"),
          node("svc1", "Service"),
          node("db1", "DataProvider")
        ],
        edges: [
          edge("Contains", "r1", "app1"),
          edge("Contains", "r1", "svc1"),
          edge("Contains", "r2", "db1"),
          
          // Violations:
          // 1. Invocation targeting DataProvider instead of Service
          edge("Invocation", "app1", "db1"),
          
          // 2. Legacy sourced from DataProvider instead of App/Service
          edge("Legacy", "db1", "svc1"),
          
          // 3. Trust issued between Service and Realm instead of two Realms
          edge("Trust", "svc1", "r2")
        ]
      };
      
      const result = validateDiagram(diagram);
      expect(result.valid).toBe(false);
      
      const allErrors = result.errors.join(" ");
      expect(allErrors).toMatch(/Invocation must be Application\/AIApplication -> Service\/AIService OR Service\/AIService -> Service\/AIService/i);
      expect(allErrors).toMatch(/Legacy must be Application\/AIApplication\/Service\/AIService -> DataProvider\/Dataset\/ProcessingUnit\/AIProcess/i);
      expect(allErrors).toMatch(/Trust must be Realm -> Realm/i);
    });

    it("TC-WAM-03: Full Diagram (Happy Path)", () => {
      // Validation Details: Complete diagram with two Realms, Trust, IdentityProvider, Services, 
      // and DataProvider with all edges correctly formed.
      // Expected Result: Passes validation with zero errors.
      const diagram = {
        nodes: [
          node("r1", "Realm"),
          node("r2", "Realm"),
          node("idp1", "IdentityProvider"),
          node("app1", "Application"),
          node("svc1", "Service"),
          node("db1", "DataProvider")
        ],
        edges: [
          edge("Contains", "r1", "idp1"),
          edge("Contains", "r1", "app1"),
          edge("Contains", "r1", "svc1"),
          edge("Contains", "r2", "db1"),
          
          // Relationships
          edge("Trust", "r1", "r2"),
          edge("Invocation", "app1", "svc1"),
          edge("Legacy", "svc1", "db1")
        ]
      };
      
      const result = validateDiagram(diagram);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

  });
});
