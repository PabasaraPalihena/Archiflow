export const docsContent = `
# ArchiFlow User Guide

Welcome to the ArchiFlow User Guide. This documentation covers everything you need to know to design, validate, and collaborate on software architecture diagrams using the WAM (Webcomposition Architecture Model).

---

## Getting Started

### What is ArchiFlow?

ArchiFlow is a web-based tool for designing, validating, and documenting software architecture diagrams based on the **WAM (Webcomposition Architecture Model)**. It provides:

- A visual drag-and-drop canvas for building architecture diagrams
- WAM-compliant element types and connection rules
- Automatic validation against WAM architectural rules
- AI-powered diagram generation from natural language descriptions
- Multiple export formats for sharing and documentation
- Cost estimation for deployment planning
- Integrations with Confluence and GitHub

### Signing Up and Logging In

1. Visit the ArchiFlow signup page and create an account with your name, email, and a password (minimum 5 characters).
2. After signing up, log in with your email and password.
3. If you forget your password, use the **Forgot Password** link on the login page to reset it via email.

### Navigating the Interface

Once logged in, you'll see the main canvas editor. The interface consists of:

- **Header** — Contains the ArchiFlow logo (click to return to canvas), action buttons (Cost Estimate, Validation, Chat with us), and your profile menu.
- **Left Panel (Palette)** — A collapsible panel with WAM elements you can drag onto the canvas.
- **Canvas** — The central workspace where you build your diagram.
- **Right Panel (Properties)** — A collapsible panel that shows details and editable properties for the selected element.
- **Footer** — Visible on non-canvas pages with links to Product pages, Resources, and Team info.

---

## The Canvas

### Editor Layout

The canvas editor is the core of ArchiFlow. It features:

- **Toolbar** at the top of the canvas with action buttons
- **Collapsible Left Panel** containing the element Palette (click the toggle arrow to expand/collapse)
- **Collapsible Right Panel** showing Properties for the selected element
- **Zoom Controls** — Use your mouse scroll wheel to zoom in and out of the canvas

### Toolbar Actions

The canvas toolbar provides these controls:

| Button | Function |
|--------|----------|
| **Select Mode** | Switch to selection mode to click and move elements |
| **Pan Mode** | Switch to pan mode to drag and navigate the canvas |
| **Undo** | Revert the last action (supports up to 20 history steps) |
| **Redo** | Redo the last undone action |
| **Delete Selected** | Remove the currently selected element (also available via the Del key) |
| **Push to GitHub** | Push diagram to a connected GitHub repository (Premium plan required) |
| **Publish to Confluence** | Publish diagram as a Confluence page (Enterprise plan required) |

### Zooming and Panning

- **Zoom**: Use your mouse scroll wheel to zoom in and out.
- **Pan**: Switch to Pan Mode in the toolbar, then click and drag to navigate around the canvas.
- **Select**: Switch back to Select Mode to interact with elements.

---

## WAM Elements

ArchiFlow supports a variety of WAM element types organized into three categories in the Palette.

### Core Elements

| Element | Shape | Description |
|---------|-------|-------------|
| **Security Realm** | Rounded rectangle with shield | A security boundary container that groups related components within a trust domain. Properties: ownerOrg, domain, publicFacing. |
| **Application** | Rounded rectangle | A main application component such as a web app or mobile app. Properties: url, ownerTeam, technology. |
| **Service** | Trapezoid | An API or service endpoint that provides functionality. Properties: endpoint, apiStyle (REST), version. |
| **Data Provider** | Cylinder (database) | A data storage system such as a database or file store. Properties: system, storageType. |
| **Process Unit** | Circle | A background processing component such as a worker or scheduler. Properties: runtime, purpose. |
| **Identity Provider** | Shield/parallelogram | An authentication and authorization service (e.g., OAuth, SAML). Properties: tokenType (SAML), issuer. |

### AI Elements

| Element | Shape | Description |
|---------|-------|-------------|
| **AI Application** | Rounded rectangle with AI dot | An AI-enabled application. Additional properties: aiFeatures, functionality, modelName, dataSensitivity, humanInTheLoop. |
| **AI Service** | Trapezoid with AI dot | An AI-powered service endpoint. Additional properties: functionality (Inference/Training), modelProvider, modelName, inputs, outputs, dataset. |
| **Dataset** | Cylinder with AI dot | A dataset for AI training or inference. Additional properties: classification (internal), inputs, outputs. |
| **AI Process** | Circle with AI dot | An AI processing pipeline. Additional properties: pipelineType (inference), functionality, modelName. |

### Connection Types

| Connection | Style | Description |
|------------|-------|-------------|
| **Invocation** | Solid line with closed arrow | Represents function calls and API invocations between components. Properties: protocol (HTTPS), auth (None), encrypted (true). |
| **Legacy** | Solid line without arrow | Represents legacy adapter connections to data stores and processes. Properties: adapter, notes. |
| **Trust** | Open arrow line with label | Represents security trust relationships between Security Realms. Properties: trustType (tokenAcceptance), notes. |

---

## Creating Diagrams

### Dragging Elements from the Palette

1. Open the left panel by clicking the toggle arrow if it's collapsed.
2. Browse the three palette sections: **WAM Core Elements**, **WAM AI Elements**, and **Connections & Links**.
3. Click and drag an element from the palette onto the canvas.
4. Elements are automatically sized — Security Realms are larger (500×320px) to contain child elements, while other elements are standard size (100×80px).

### Connecting Elements

1. Select a link type from the **Connections & Links** section in the palette.
2. Click on the source node, then click on the target node to create the connection.
3. Connection handles are available on all four sides (top, right, bottom, left) plus corner positions of each element.
4. Connections must follow WAM rules (see the Validation section for details).

### Nesting Elements Inside Security Realms

- Drag elements into a Security Realm to place them within that security boundary.
- ArchiFlow auto-detects when you drag an element into or out of a Security Realm and updates the containment relationship.
- All non-Realm elements should be placed inside a Security Realm for WAM compliance.

### Editing Element Properties

1. Click on any element on the canvas to select it.
2. The **Properties Panel** opens on the right side, showing:
   - Element name/label (editable)
   - Element description (editable)
   - Type-specific properties (e.g., endpoint, apiStyle for Services)
   - Custom properties you can add
3. Changes to properties are reflected immediately on the canvas.

---

## Saving and Managing Diagrams

### Saving a Diagram

1. Your diagram is validated automatically before saving.
2. If validation passes, the diagram is saved to your account with its metadata (name, description, type, tags).
3. If validation fails, the **Validation Panel** opens showing errors with specific fix recommendations. You'll need to resolve violations before saving.

### Unsaved Changes Warning

- If you modify the canvas and try to navigate away, a confirmation dialog appears: *"You have unsaved changes on the canvas. Are you sure you want to leave? Your diagram will be lost."*
- Choose **Leave** to discard changes, or close the dialog to stay on the canvas.

### My Diagrams Page

Access **My Diagrams** from the header profile dropdown to manage your saved work:

- **Load** — Click a diagram to load it back onto the canvas for editing.
- **Rename** — Change the name of a saved diagram.
- **Delete** — Permanently remove a diagram from your account.

---

## Export and Import

### Export Formats

ArchiFlow supports exporting your diagrams in multiple formats. Availability depends on your subscription plan.

| Format | Description | Plan Required |
|--------|-------------|---------------|
| **JSON** | Full diagram data with all nodes, edges, and properties | Developer (Free) |
| **CSV** | Spreadsheet format with separate nodes and edges tables | Developer (Free) |
| **XML** | Structured hierarchical format | Developer (Free) |
| **Turtle/N3** | RDF semantic web format for linked data applications | Professional+ |
| **JSON-LD** | JSON-based linked data format | Professional+ |
| **PNG** | Visual screenshot of the diagram as an image | Enterprise |

### Importing Diagrams

- ArchiFlow accepts **JSON** format for importing diagrams.
- Use the import option in the Properties Panel to upload a previously exported JSON file.
- The imported diagram replaces the current canvas content.

---

## Validation

### How Validation Works

ArchiFlow validates your diagrams against WAM (Webcomposition Architecture Model) rules to ensure architectural correctness. Validation runs automatically before saving and can also be triggered manually using the **Validation** button in the header (enabled once your canvas has at least one element).

### Validation Rules

Your diagram must follow these WAM rules:

1. **Security Realm Required** — Every diagram must contain at least one Security Realm.
2. **Containment** — All non-Realm elements must be placed inside a Security Realm.
3. **Trust Connections** — Trust edges can only connect one Security Realm to another Security Realm.
4. **Invocation Connections** — Invocation edges are only allowed from Application/AI Application/Service/AI Service to Service/AI Service.
5. **Legacy Connections** — Legacy edges are only allowed from Application/AI Application/Service/AI Service to Data Provider/Dataset/Process Unit/AI Process.
6. **Identity Provider Isolation** — Identity Provider elements cannot have standard use edges (only containment within a Realm).

### Understanding Validation Results

When validation completes:

- **Success**: A green checkmark with "WAM-compliant" message confirms your diagram follows all rules.
- **Failure**: The Validation Panel shows numbered violation cards, each containing:
  - A description of what went wrong
  - The elements involved (e.g., "Application → DataProvider via Trust")
  - The allowed rule for that connection type
  - A fix suggestion with specific actionable steps

### Fixing Violations

Follow the fix suggestions in each violation card. Common fixes include:

- Moving elements inside a Security Realm
- Changing the connection type between elements
- Removing invalid connections
- Adding a missing Security Realm

Validation results automatically clear when you modify the diagram, allowing you to re-validate after making fixes.

---

## Cost Estimation

### What is Cost Estimation?

Cost Estimation analyzes your architecture diagram and estimates deployment costs across three tiers: **Small**, **Production**, and **Enterprise**. Costs are displayed in EUR (€) per month.

> **Note:** Cost Estimation requires a Standard or Premium subscription plan. Developer (Free) plan users will be prompted to upgrade.

### Running a Cost Estimate

1. Click the **Cost Estimate** button in the header while on the canvas.
2. The system analyzes all components and connections in your diagram.
3. A loading spinner appears while costs are calculated.

### Understanding the Cost Report

The cost report includes:

- **Cost Cards** — One card per deployment tier (Small, Production, Enterprise) showing total monthly cost.
- **Component Breakdown** — A detailed table listing each component's base cost and final cost after modifiers.
- **Modifier Details** — Collapsible sections showing what cost adjustments were applied and why.
- **Usage Overrides** — Custom usage parameters per component that affect cost calculations.

The **Production** tier is highlighted as the recommended option for most deployments.

---

## AI Chat Assistant

### Opening the Chat

Click the **Chat with us** button in the header to open the AI chat widget. The chat is available on every page.

### Generating Diagrams from Text

1. Type a description of your desired architecture in the chat input. For example: *"Create a web application with a REST API service, a PostgreSQL database, and an OAuth identity provider, all within a security realm."*
2. The AI generates a WAM-compliant diagram based on your description.
3. The AI automatically validates the generated diagram against WAM rules.
4. If validation fails, the AI repairs violations and regenerates the diagram.
5. Click **Apply to Canvas** to load the AI-generated diagram onto your canvas.

### Image-to-Diagram

1. Click the 📎 (attachment) icon in the chat input area.
2. Upload a screenshot or photo of an existing architecture diagram.
3. The AI analyzes the image and converts it into a WAM-compliant diagram.
4. Review the generated diagram and apply it to your canvas.

### Voice Input

Click the microphone button in the chat input to speak your diagram description instead of typing. See the Voice Prompts section for details.

### AI Prompt Limits

Your AI usage is tracked and displayed in the chat widget (prompts used / limit / remaining). Limits depend on your subscription plan:

- **Developer (Free)** — Limited prompts per day
- **Professional** — Higher daily limit
- **Enterprise** — Unlimited prompts

---

## Voice Prompts

### Using the Microphone

1. Open the AI Chat widget.
2. Click the **microphone icon** in the chat input area.
3. The icon turns red to indicate it's listening.
4. Speak your diagram description clearly.
5. Speech recognition stops automatically when you finish speaking.
6. Your spoken text appears in the chat input, ready to send.

### Browser Compatibility

Voice input uses the Web Speech API and is supported in:

- Google Chrome
- Microsoft Edge
- Safari

If your browser doesn't support speech recognition, a notification will appear: *"Your browser does not support speech recognition."*

---

## Integrations

ArchiFlow integrates with external tools for documentation and version control. Integrations are available on Premium and Enterprise plans.

### Confluence Integration

Connect ArchiFlow to your Confluence workspace to publish architecture diagrams as documentation pages.

1. Navigate to **Integrations** from the profile dropdown or footer.
2. Click **Connect** next to Confluence.
3. Authenticate via OAuth with your Atlassian account.
4. Once connected, you can:
   - Browse your Confluence spaces and pages
   - Publish diagrams directly from the canvas toolbar using the **Publish to Confluence** button
   - Create architecture documentation pages in your chosen space

> **Required Plan:** Enterprise

### GitHub Integration

Connect ArchiFlow to GitHub to store and version-control your architecture diagrams.

1. Navigate to **Integrations** from the profile dropdown or footer.
2. Click **Connect** next to GitHub.
3. Authenticate with your GitHub account.
4. Once connected, you can:
   - View your repositories and branches
   - Push diagrams to a repository using the **Push to GitHub** button on the canvas toolbar
   - Track diagram changes alongside your codebase

> **Required Plan:** Premium or Enterprise

### Managing Integrations

- View connection status (Connected / Not Connected) on the Integrations page.
- See your connected account details and recent activity.
- Disconnect at any time by clicking the **Disconnect** button.

---

## Subscription and Pricing

### Available Plans

| Feature | Developer (Free) | Professional (Standard) | Enterprise (Premium) |
|---------|-------------------|-------------------------|----------------------|
| **Price** | €0/month | Paid (monthly) | Paid (monthly) |
| **Manual & AI Drawing** | ✅ | ✅ | ✅ |
| **Model Validation** | ✅ | ✅ | ✅ |
| **Cost Modeling** | ❌ | ✅ | ✅ |
| **Voice Commands** | ✅ | ✅ | ✅ |
| **Export: JSON, CSV, XML** | ✅ | ✅ | ✅ |
| **Export: Turtle/N3, JSON-LD** | ❌ | ✅ | ✅ |
| **Export: PNG** | ❌ | ❌ | ✅ |
| **Confluence Integration** | ❌ | ❌ | ✅ |
| **GitHub Integration** | ❌ | ✅ | ✅ |
| **AI Prompts** | Limited/day | Higher limit/day | Unlimited |

### Upgrading or Downgrading

- Visit the **Pricing & Plans** page from the profile dropdown.
- Click **Upgrade Now** on the plan you'd like to switch to.
- You can downgrade back to the Free plan at any time.
- When you try to use a feature that requires a higher plan, an upgrade modal will appear with details about what you'll unlock.

---

## Account and Settings

Access your account settings by clicking **Settings** in the profile dropdown or footer.

### Profile Information

- **Email** — Your registered email (read-only).
- **Username** — Edit your display name and click **Update Profile** to save.
- **Location** — Edit your location and click **Update Profile** to save.

### Current Plan

The Settings page displays your current subscription plan with:

- Plan name and badge
- Monthly price (for paid plans)
- Daily AI prompt limit
- A checklist of included features

### Changing Your Password

1. Enter your **current password**.
2. Enter your **new password** (minimum 5 characters).
3. Confirm the new password.
4. Click **Change Password**.

Use the eye icon next to each password field to toggle visibility.

### Deleting Your Account

> **Warning:** This action is permanent and cannot be undone.

1. Scroll to the **Danger Zone** section at the bottom of Settings.
2. Click **Delete Account**.
3. Confirm the deletion in the dialog that appears.
4. Your account and all associated data will be permanently removed.

---

## Frequently Asked Questions

For quick answers to common questions, visit the dedicated [FAQ page](/faq) accessible from the profile dropdown or footer.

Topics covered include creating diagrams, export/import formats, validation rules, cost estimation, profile management, password changes, account deletion, subscription plans, and integrations.
`;
