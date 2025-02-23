import React, { useState, useEffect, useRef } from "react";

const languageMap = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  ru: "Russian",
  tr: "Turkish",
};

const Homepage = () => {
  const [languageDetector, setLanguageDetector] = useState(null);
  const [summarizer, setSummarizer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const buttonRef = useRef(null);
  const abortControllers = useRef(new Map());

  useEffect(() => {
    const savedMessages = localStorage.getItem("chatMessages");
    const savedInput = localStorage.getItem("chatInput");
    if (savedMessages && messages.length === 0) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
      } catch (error) {
        console.error("Failed to parse messages from localStorage:", error);
      }
    }
    if (savedInput) {
      setInput(savedInput);
    }
  }, []);
  
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("chatMessages", JSON.stringify(messages));
      } catch (error) {
        console.error("Failed to save messages to localStorage:", error);
      }
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("chatInput", input);
  }, [input]);

  const handleClearChat = () => {
    setMessages([]);
    setInput("");
    localStorage.removeItem("chatMessages");
    localStorage.removeItem("chatInput");
  };

  useEffect(() => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile && window.innerWidth <= 768) {
      alert(
        "This feature is not supported on mobile devices. Please use a desktop browser."
      );
    }
  }, []);

  useEffect(() => {
    async function setupLanguageDetector() {
      if (!("ai" in self) || !self.ai.languageDetector) {
        console.error(
          "Language Detector API is not supported in this browser."
        );
        return;
      }

      const capabilities = await self.ai.languageDetector.capabilities();
      if (capabilities.available === "no") {
        console.error("Language Detector is not usable.");
        return;
      }

      let detector;
      if (capabilities.available === "readily") {
        detector = await self.ai.languageDetector.create();
      } else {
        const controller = new AbortController();
        detector = await self.ai.languageDetector.create({
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
            });
          },
          signal: controller.signal,
        });
        abortControllers.current.set("languageDetector", controller);
        await detector.ready;
      }
      setLanguageDetector(detector);
    }
    setupLanguageDetector();
    return () => abortControllers.current.get("languageDetector")?.abort();
  }, []);

  useEffect(() => {
    async function setupSummarizer() {
      if (!("ai" in self) || !self.ai.summarizer) return;

      const capabilities = await self.ai.summarizer.capabilities();
      if (capabilities.available === "no") return;

      let summarizer;
      if (capabilities.available === "readily") {
        summarizer = await self.ai.summarizer.create({
          type: "key-points",
          length: "medium",
          format: "plain-text",
        });
      } else {
        const controller = new AbortController();
        summarizer = await self.ai.summarizer.create({
          type: "key-points",
          length: "medium",
          format: "plain-text",
          monitor(m) {
            m.addEventListener("downloadprogress", console.log);
          },
          signal: controller.signal,
        });
        abortControllers.current.set("summarizer", controller);
        await summarizer.ready;
      }
      setSummarizer(summarizer);
    }
    setupSummarizer();
    return () => abortControllers.current.get("summarizer")?.abort();
  }, []);

  const detectLanguage = async (text) => {
    if (!text.trim() || !languageDetector) return null;

    return new Promise(async (resolve) => {
      try {
        const results = await languageDetector.detect(text);
        if (results.length > 0 && results[0].confidence > 0.5) {
          resolve(results[0].detectedLanguage);
          return;
        }
      } catch (error) {
        console.error("Language detection failed:", error);
      }
      resolve(null);
    });
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const detectedLang = await detectLanguage(input);
    setMessages((prev) => [
      ...prev,
      {
        text: input,
        originalText: input,
        sender: "user",
        sourceLanguage: detectedLang,
        targetLanguage: "en",
        translated: false,
      },
    ]);
    setInput("");
  };

  const handleSummarize = async (text, index) => {
    if (!summarizer) return;

    setIsSummarizing(true);
    try {
      const controller = new AbortController();
      const summary = await summarizer.summarize(text, {
        signal: controller.signal,
        chunkSize: 500,
      });

      setMessages((prev) => [
        ...prev.slice(0, index + 1),
        {
          text: summary,
          sender: "bot",
          summary: true,
        },
        ...prev.slice(index + 1),
      ]);
    } catch (error) {
      console.error("Summarization failed:", error);

      setMessages((prev) => [
        ...prev.slice(0, index + 1),
        {
          text: "Failed to generate summary. Please try again.",
          sender: "bot",
          summary: true,
        },
        ...prev.slice(index + 1),
      ]);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleTranslate = async (index) => {
    const message = messages[index];
    if (
      !message.sourceLanguage ||
      message.sourceLanguage === message.targetLanguage
    )
      return;

    try {
      const translatorCapabilities = await self.ai.translator.capabilities();
      const available = translatorCapabilities.languagePairAvailable(
        message.sourceLanguage,
        message.targetLanguage
      );

      if (available === "no") return;

      const controller = new AbortController();
      const translator = await self.ai.translator.create({
        sourceLanguage: message.sourceLanguage,
        targetLanguage: message.targetLanguage,
        monitor:
          available === "after-download"
            ? (m) => {
                m.addEventListener("downloadprogress", console.log);
              }
            : undefined,
        signal: controller.signal,
      });

      abortControllers.current.set(`translate-${index}`, controller);

      if (available === "after-download") await translator.ready;

      const translatedText = await translator.translate(
        message.translated ? message.originalText : message.text,
        { signal: controller.signal }
      );

      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[index] = {
          ...newMessages[index],
          text: translatedText,
          sourceLanguage: message.targetLanguage,
          targetLanguage: message.sourceLanguage,
          translated: true,
        };
        return newMessages;
      });
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Translation failed:", error);
      }
    } finally {
      abortControllers.current.delete(`translate-${index}`);
    }
  };

  const handleLanguageChange = (index, newLang) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      newMessages[index] = {
        ...newMessages[index],
        targetLanguage: newLang,
        translated: false,
      };
      return newMessages;
    });
  };

  const wordCount = (text) => text.trim().split(/\s+/).length;

  return (<>
  <h1 className="heading">AI TEXT INTERFACE</h1>
    <div className="chatbox">
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className="message-case">
            <div
              className={`message ${
                msg.sender === "user" ? "user-msg" : "bot-msg"
              }`}
            >
              {msg.text}
              {msg.translated && (
                <div className="translation-note">
                  (Translated to{" "}
                  {languageMap[msg.sourceLanguage] || msg.sourceLanguage})
                </div>
              )}
            </div>
            {msg.sender === "user" && (
              <div className="language-info">
                <p>
                  Detected Language:{" "}
                  {languageMap[msg.sourceLanguage] || msg.sourceLanguage}
                </p>
                <select
                  className="languages-dropdown"
                  value={msg.targetLanguage}
                  onChange={(e) => handleLanguageChange(index, e.target.value)}
                >
                  {Object.entries(languageMap).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  className="translate-btn"
                  onClick={() => handleTranslate(index)}
                >
                  {msg.translated ? "Retranslate" : "Translate"}
                </button>
                {wordCount(msg.originalText) > 150 && (
                  <button
                    className="summarize-btn"
                    onClick={() => handleSummarize(msg.originalText, index)}
                  >
                    Summarize
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {isSummarizing && (
  <div className="loading-spinner">
    <div className="spinner"></div>
    <div className="loading-text">Summarizing...</div>
  </div>
)}

      <div className="input-case">
        <textarea
          className="input-box"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buttonRef.current.click()}
        ></textarea>
        <button className="send" ref={buttonRef} onClick={handleSendMessage}>
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </div>

      <button className="clear-chat-btn" onClick={handleClearChat}>
        Clear Chat
      </button>
    </div>
    </>
  );
};

export default Homepage;
