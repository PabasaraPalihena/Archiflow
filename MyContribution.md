# My Contributions to ArchiFlow

**ArchiFlow** is a pitch-winning group project developed collaboratively by a five-member team. It is an interactive system architecture editor based on the **WebComposition Architecture Model (WAM)**.

The application combines visual modelling, AI-assisted generation, architecture validation, export capabilities, integration features, and user management in one collaborative platform.

This document highlights my individual contributions to the implementation of the application.

### WAM Modelling Canvas

- Implemented the interactive WAM modelling canvas using **React Flow**
- Added support for: drag-and-drop element placement, free positioning, zooming and panning, grid snapping, interactive selection
- Implemented undo/redo history using a snapshot-based state stack

### WAM Elements and Relationship Modelling

- Implemented a structured palette of WAM elements organised into two categories:
  - **Core WAM**: Application, Service, Data Provider, Process Unit, Identity Provider, Security Realm
  - **WAM-AI Extensions**: AI Service, AI Application, Dataset, AI Process
- Designed distinct SVG-based visual representations for each element type
- Implemented **Relationship types**: Invocation, Trust, Legacy
- Implemented hierarchical containment logic via ReactFlow parent–child nesting within Security Realms
- Added automatic containment detection when elements are dropped inside a Security Realm
- Implemented backend constraint validation to enforce valid connections between compatible element types

### Metadata and Product Descriptive Language

- Introduced human-readable labels and descriptions for WAM elements and relationships
- Developed a contextual Element tab in the property panel that dynamically renders fields based on element/relationship type
- Implemented type-specific default property schemas (endpoints, storage types, runtime, AI metadata)
- Added AI-specific metadata fields: model name, functionality type, bias considerations, data sensitivity
- Implemented relationship-level properties: protocol, auth, encryption for Invocation; trust type for Trust; adapter for Legacy
- Added configurable edge handle attachment point selection (8 positions per node)
- Ensured real-time reactive data binding between the property panel and the canvas
- Added machine-readable metadata through structured key–value properties
- Implemented default metadata templates based on element and relationship type
- Enabled dual-layer descriptive language (human-readable + machine-readable) propagated through all export formats

### Model Export & Import Features

- Implemented **JSON export** capturing elements, relationships, descriptive attributes, and spatial positioning
- Implemented **JSON-LD export** with `@context`/`@graph` structure using WAM, RDFS, and Dublin Core namespaces
- Implemented **Turtle (RDF) export** with reified edges and namespace-prefixed predicates for semantic interoperability
- Preserved labels, descriptions, typed resources, relationships, and metadata across all export formats
- Implemented JSON-based diagram import with schema validation and canvas re-hydration

### Rendering AI-Generated Diagrams on the Canvas

- Implemented the mapAiDiagramToCanvas() function to transform AI-generated diagram data into ReactFlow-compatible nodes and edges
- Added fuzzy type normalisation to handle AI output variations and typos
- Implemented automatic containment resolution with heuristic assignment to Security Realms
- Built a topological-sort–based hierarchical layout algorithm for automatic node positioning
- Added algorithmic edge handle selection to minimise visual overlap

### Diagram Management

- Implemented backend RESTful endpoints for loading, updating, and deleting diagrams
- Added frontend interface for displaying saved diagrams, loading for editing, and triggering updates/deletions
- Added authorization checks to ensure only the diagram owner can modify or remove saved diagrams
- Implemented diagram import functionality with client-side JSON parsing and schema validation

### External Platform Integrations

#### Git-Based Version Control

- Added support for exporting diagrams and pushing them to Git-based repositories
- Implemented frontend modal for repository and commit details
- Built backend logic to create/update files and register commits through the Git platform API

#### Confluence Integration

- Implemented publishing diagrams into **Confluence** pages for collaborative review
- Added UI for publication parameters such as space and page details
- Built backend integration with the Confluence REST API to create/update pages

### Subscription Tiers

- Designed and implemented a three-tier subscription system (Developer, Professional, Enterprise)
- Defined centralised plan configuration with feature flags, export allowlists, and AI prompt limits
- Stored subscription state as an embedded sub-document in the MongoDB User schema
- Implemented RESTful endpoints for plan retrieval, current plan lookup, and plan upgrades
- Built checkAiUsage middleware for daily AI rate limiting with automatic counter reset
- Enforced frontend feature gating via conditional rendering (export locks, cost modelling, voice, integrations)
- Implemented UpgradeModal component for contextual upsell prompts on restricted features
- Built PricingPage with dynamic plan comparison cards and one-click upgrade flow
- Added real-time AI usage counter display within the chat interface
