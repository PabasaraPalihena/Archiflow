import { useState } from "react";
import "./FAQ.css";

type FAQItem = {
  question: string;
  answer: string;
};

const faqData: FAQItem[] = [
  {
    question: "How do I create a diagram?",
    answer:
      "You can create a diagram in two ways: \n\n" +
      "1. Manually: Drag components from the left palette into the canvas and connect them using the link tools.\n\n" +
      "2. Using AI: Simply describe your desired diagram or workflow in the chat. You can type your prompt or use the microphone to speak your idea, and the AI assistant will automatically generate the diagram for you.",
  },
  {
    question: "How can I export or import diagrams?",
    answer: "special:export-import",
  },
  {
    question: "How does validation work?",
    answer: "special:validation",
  },
  {
    question: "How do I estimate costs?",
    answer:
      "Use the Cost Estimate button. The system analyzes your diagram and generates an estimated cost report.",
  },
  {
    question: "How do I change my Username or Location?",
    answer:
      "Go to Settings → Enter your new Username or Location →  Click Change Update profile.",
  },
  {
    question: "How do I change my password?",
    answer:
      "Go to Settings → Enter your old password → Enter new password → Click Change Password.",
  },
  {
    question: "How do I delete my account?",
    answer: "Go to Settings → Scroll to Danger Zone → Click Delete Account.",
  },
  {
    question: "Does ArchiFlow offer different subscription plans?",
    answer:
      "Yes. ArchiFlow offers three subscription tiers: Free, Standard, and Premium. Each plan provides different features and capabilities. You can compare them in the Pricing & Plans section.",
  },
  {
    question: "Does ArchiFlow integrate with other tools?",
    answer:
      "Yes. ArchiFlow integrates with tools like Confluence and GitHub to help streamline your workflow. More details are available in the Integrations section.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-container">
      <div className="faq-card">
        <h1 className="faq-title">Frequently Asked Questions</h1>

        {faqData.map((item, index) => (
          <div key={index} className="faq-item">
            <button className="faq-question" onClick={() => toggle(index)}>
              {item.question}
              <span className="faq-icon">
                {openIndex === index ? "−" : "+"}
              </span>
            </button>

            {openIndex === index && (
              <div className="faq-answer">
                {openIndex === index && (
                  <div className="faq-answer">
                    {item.question === "How do I create a diagram?" ? (
                      <div>
                        <p>You can create a diagram in two ways:</p>

                        <p>
                          <strong>1. Manually:</strong> Drag components from the
                          left palette into the canvas and connect them using
                          the link tools.
                        </p>

                        <p>
                          <strong>2. Using AI:</strong> Simply describe your
                          desired diagram or workflow in the chat. You can type
                          your prompt or use the microphone to speak your idea,
                          and the AI assistant will automatically generate the
                          diagram for you.
                        </p>
                      </div>
                    ) : item.answer === "special:export-import" ? (
                      <div className="faq-special">
                        <p>
                          You can export your diagram in multiple professional
                          formats:
                        </p>

                        <ul>
                          <li>
                            <strong>JSON</strong> - Full diagram data with all
                            nodes & edges
                          </li>
                          <li>
                            <strong>CSV</strong> - Spreadsheet format (nodes and
                            edges tables)
                          </li>
                          <li>
                            <strong>XML</strong> - Structured hierarchical
                            format
                          </li>
                          <li>
                            <strong>Turtle / N3</strong> - RDF format for
                            semantic web
                          </li>
                          <li>
                            <strong>JSON-LD</strong> - Linked data JSON format
                          </li>
                          <li>
                            <strong>PNG</strong> - Visual diagram screenshot
                          </li>
                        </ul>

                        <p>
                          You can also import supported formats to restore or
                          continue working on previously saved diagrams.
                        </p>
                      </div>
                    ) : item.answer === "special:validation" ? (
                      <div className="faq-special">
                        <p>
                          Click the Validation button in the header. The system
                          checks your diagram against backend rules. The
                          validation rules are as follows:
                        </p>
                        <ul>
                          <li>
                            <strong>Trust:</strong> Only Realm to Realm
                          </li>
                          <li>
                            <strong>Invocation:</strong> Application to Service
                            and Service to Service only
                          </li>
                          <li>
                            <strong>Legacy connection:</strong> Application to
                            Data Provider / Process Unit or Service to Data
                            Provider / Process Unit
                          </li>
                          <li>
                            <strong>Contains (Realm):</strong> Realm contains
                            one or more elements (Applications, Services,
                            Identity Provider, Data Unit, Process Unit, etc.)
                          </li>
                          <li>
                            <strong>Identity provider:</strong> No use edges
                          </li>
                        </ul>
                      </div>
                    ) : (
                      item.answer
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
