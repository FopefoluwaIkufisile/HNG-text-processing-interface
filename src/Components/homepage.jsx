import React, { useState, useEffect, useRef } from "react";

const languageMap = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
};

const Homepage = () => {
  const [languageDetector, setLanguageDetector] = useState(null);
  const [summarizer, setSummarizer] = useState(null);
  const [translator, setTranslator] = useState(null);
  const [language, setLanguage] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const buttonRef = useRef(null);
  let detectTimeout = null;

  useEffect(() => {
    async function setupLanguageDetector() {
      if (!("ai" in self) || !self.ai.languageDetector) {
        console.error("AI Language Detector API is not available.");
        return;
      }

      const languageDetectorCapabilities = await self.ai.languageDetector.capabilities();
      if (languageDetectorCapabilities.available === "no") {
        console.error("Language Detector is not usable.");
        return;
      }

      let detector;
      if (languageDetectorCapabilities.available === "readily") {
        detector = await self.ai.languageDetector.create();
      } else {
        detector = await self.ai.languageDetector.create({
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
            });
          },
        });
        await detector.ready;
      }

      setLanguageDetector(detector);
    }

    setupLanguageDetector();
  }, []);

  useEffect(() => {
    async function setupSummarizer() {
      if (!("ai" in self) || !self.ai.summarizer) {
        console.error("Summarizer API is not available.");
        return;
      }

      const summarizerCapabilities = await self.ai.summarizer.capabilities();
      if (summarizerCapabilities.available === "no") return;

      let summarizerInstance;
      if (summarizerCapabilities.available === "readily") {
        summarizerInstance = await self.ai.summarizer.create();
      } else {
        summarizerInstance = await self.ai.summarizer.create({
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
            });
          },
        });
        await summarizerInstance.ready;
      }
      setSummarizer(summarizerInstance);
    }
    setupSummarizer();
  }, []);

  useEffect(() => {
    async function setupTranslator() {
      if (!("ai" in self) || !self.ai.translator) {
        console.error("Translator API is not available.");
        return;
      }

      const translatorCapabilities = await self.ai.translator.capabilities();
      if (translatorCapabilities.languagePairAvailable(language, targetLanguage) === "no") {
        console.error("Translation not supported for this language pair.");
        return;
      }

      let translatorInstance;
      if (translatorCapabilities.languagePairAvailable(language, targetLanguage) === "readily") {
        translatorInstance = await self.ai.translator.create({
          sourceLanguage: language,
          targetLanguage: targetLanguage,
        });
      } else {
        translatorInstance = await self.ai.translator.create({
          sourceLanguage: language,
          targetLanguage: targetLanguage,
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
            });
          },
        });
        await translatorInstance.ready;
      }
      setTranslator(translatorInstance);
    }

    if (language && targetLanguage) {
      setupTranslator();
    }
  }, [language, targetLanguage]);

  const detectLanguage = async (text) => {
    if (!text.trim()) {
      setLanguage("");
      return;
    }

    if (!languageDetector) {
      console.error("Language detector is not initialized.");
      return;
    }

    if (detectTimeout) clearTimeout(detectTimeout);

    detectTimeout = setTimeout(async () => {
      try {
        const results = await languageDetector.detect(text);
        if (results.length > 0) {
          const langCode = results[0].detectedLanguage;
          setLanguage(langCode);
        }
      } catch (error) {
        console.error("Language detection failed:", error);
      }
    }, 500);
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [
      ...prev,
      { text: input, sender: "user", language },
    ]);
    detectLanguage(input);
    setInput("");
  };

  const handleSummarize = async (text) => {
    if (!summarizer) {
      console.error("Summarizer not initialized");
      return;
    }

    try {
      const summary = await summarizer.summarize(text);
      setMessages((prev) => [
        ...prev,
        { text: summary, sender: "bot" },
      ]);
    } catch (error) {
      console.error("Summarization failed:", error);
    }
  };

  const handleTranslate = async (text, index) => {
    if (!translator) {
      console.error("Translator not initialized");
      return;
    }

    try {
      const translatedText = await translator.translate(text);
      const updatedMessages = [...messages];
      updatedMessages[index].text = translatedText;
      setMessages(updatedMessages);
    } catch (error) {
      console.error("Translation failed:", error);
    }
  };

  const wordCount = (text) => text.trim().split(/\s+/).length;

  return (
    <div className="chatbox">
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index}>
            <div className={`message ${msg.sender === "user" ? "user-msg" : "bot-msg"}`}>
              {msg.text}
            </div>
            {msg.sender === "user" && msg.language && (
              <div className="language-info">
                <p>Detected Language: {languageMap[msg.language] || msg.language}</p>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                >
                  {Object.keys(languageMap).map((langCode) => (
                    <option key={langCode} value={langCode}>
                      {languageMap[langCode]}
                    </option>
                  ))}
                </select>
                <button onClick={() => handleTranslate(msg.text, index)}>
                  Translate
                </button>
                {wordCount(msg.text) > 150 && (
                  <button onClick={() => handleSummarize(msg.text)}>
                    Summarize
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="input-case">
        <div className="top">
          <input
            type="text"
            className="input-box"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              detectLanguage(e.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                buttonRef.current.click();
              }
            }}
          />
          <button ref={buttonRef} className="send" onClick={handleSendMessage}>
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Homepage;