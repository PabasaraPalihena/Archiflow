const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");
const User = require("../models/User");
const Diagram = require("../models/Diagram");

const JWT_SECRET = process.env.JWT_SECRET;

let token;
let user;

beforeEach(async () => {
  user = await User.create({
    name: "Test User",
    email: "test@example.com",
    password: "password123",
    location: "Test City",
  });

  const payload = { user: { id: user.id } };
  token = jwt.sign(payload, JWT_SECRET);
});

describe("Diagram Routes (Main Canvas)", () => {
  it("should save a new diagram", async () => {
    const res = await request(app)
      .post("/api/save-diagram")
      .set("auth-token", token)
      .send({
        name: "Unit Test Diagram",
        description: "Testing diagram save",
        type: "Architecture Diagram",
        diagramData: { nodes: [{ id: "1", type: "custom" }], edges: [] },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.diagram.name).toBe("Unit Test Diagram");

    // Verify it was added to User's myDiagrams
    const updatedUser = await User.findById(user.id);
    expect(updatedUser.myDiagrams).toHaveLength(1);
    expect(updatedUser.myDiagrams[0].toString()).toBe(res.body.diagram._id);
  });

  it("should not save a diagram without elements", async () => {
    const res = await request(app)
      .post("/api/save-diagram")
      .set("auth-token", token)
      .send({
        name: "Empty Diagram",
        diagramData: { nodes: [], edges: [] },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Diagram must have at least one element");
  });

  it("should retrieve my diagrams", async () => {
    const d1 = await Diagram.create({
      name: "D1",
      diagramData: { nodes: [{ id: "1" }] },
      user: user.id,
    });
    const d2 = await Diagram.create({
      name: "D2",
      diagramData: { nodes: [{ id: "2" }] },
      user: user.id,
    });

    await User.findByIdAndUpdate(user.id, {
      $push: { myDiagrams: { $each: [d1._id, d2._id] } },
    });

    const res = await request(app)
      .get("/api/my-diagrams")
      .set("auth-token", token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.diagrams).toHaveLength(2);
    // Newest first
    expect(res.body.diagrams[0].name).toBe("D2");
  });

  it("should retrieve a single diagram by ID", async () => {
    const d1 = await Diagram.create({
      name: "Single Diagram",
      diagramData: { nodes: [{ id: "99" }] },
      user: user.id,
    });

    const res = await request(app).get(`/api/diagrams/${d1._id}`);
    expect(res.status).toBe(200);
    expect(res.body.diagram.name).toBe("Single Diagram");
  });

  it("should update an existing diagram", async () => {
    const d1 = await Diagram.create({
      name: "Old Name",
      diagramData: { nodes: [{ id: "1" }] },
      user: user.id,
    });

    const res = await request(app)
      .put(`/api/diagrams/${d1._id}`)
      .set("auth-token", token)
      .send({
        name: "New Name",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.diagram.name).toBe("New Name");

    const inDb = await Diagram.findById(d1._id);
    expect(inDb.name).toBe("New Name");
  });

  it("should delete an existing diagram", async () => {
    const d1 = await Diagram.create({
      name: "To Delete",
      diagramData: { nodes: [{ id: "1" }] },
      user: user.id,
    });
    await User.findByIdAndUpdate(user.id, {
      $push: { myDiagrams: d1._id },
    });

    const res = await request(app)
      .delete(`/api/diagrams/${d1._id}`)
      .set("auth-token", token);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Diagram deleted");

    const inDb = await Diagram.findById(d1._id);
    expect(inDb).toBeNull();

    const updatedUser = await User.findById(user.id);
    expect(updatedUser.myDiagrams).toHaveLength(0);
  });
});
