import React, { useState, useEffect, useRef } from "react";

const languageMap = {
  en: "English",
  es: "Spanish",
  fr: "French",
  ru: "Russian",
  tr: "Turkish",
  pt: "Portuguese",
};

const Homepage = () => {
  const [languageDetector, setLanguageDetector] = useState(null);
  const [summarizer, setSummarizer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const buttonRef = useRef(null);
  let detectTimeout = null;

  useEffect(() => {
    async function setupLanguageDetector() {
      if (!("ai" in self) || !self.ai.languageDetector) return;
      const capabilities = await self.ai.languageDetector.capabilities();
      if (capabilities.available === "no") return;

      let detector;
      if (capabilities.available === "readily") {
        detector = await self.ai.languageDetector.create();
      } else {
        detector = await self.ai.languageDetector.create({
          monitor(m) {
            m.addEventListener("downloadprogress", console.log);
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
      if (!("ai" in self) || !self.ai.summarizer) return;
      const capabilities = await self.ai.summarizer.capabilities();
      if (capabilities.available === "no") return;

      let summarizer;
      if (capabilities.available === "readily") {
        summarizer = await self.ai.summarizer.create();
      } else {
        summarizer = await self.ai.summarizer.create({
          monitor(m) {
            m.addEventListener("downloadprogress", console.log);
          },
        });
        await summarizer.ready;
      }
      setSummarizer(summarizer);
    }
    setupSummarizer();
  }, []);

  const detectLanguage = async (text) => {
    if (!text.trim() || !languageDetector) return;
    
    clearTimeout(detectTimeout);
    return new Promise(resolve => {
      detectTimeout = setTimeout(async () => {
        try {
          const results = await languageDetector.detect(text);
          if (results.length > 0) {
            return resolve(results[0].detectedLanguage);
          }
        } catch (error) {
          console.error("Language detection failed:", error);
        }
        resolve(null);
      }, 500);
    });
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const detectedLang = await detectLanguage(input);
    setMessages(prev => [
      ...prev,
      { 
        text: input,
        originalText: input,
        sender: "user",
        sourceLanguage: detectedLang,
        targetLanguage: "en",
        translated: false
      }
    ]);
    setInput("");
  };

  const handleSummarize = async (text, index) => {
    if (!summarizer) return;
    
    try {
      const summary = await summarizer.summarize(text);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[index] = { ...newMessages[index], summary };
        return newMessages;
      });
    } catch (error) {
      console.error("Summarization failed:", error);
    }
  };

  const handleTranslate = async (index) => {
    const message = messages[index];
    if (!message.sourceLanguage || message.sourceLanguage === message.targetLanguage) return;

    try {
      const capabilities = await self.ai.translator.capabilities();
      const available = capabilities.languagePairAvailable(
        message.sourceLanguage,
        message.targetLanguage
      );

      if (available === "no") {
        console.error("Translation not supported for this language pair");
        return;
      }

      const translator = await self.ai.translator.create({
        sourceLanguage: message.sourceLanguage,
        targetLanguage: message.targetLanguage,
        monitor: available === "after-download" ? (m) => {
          m.addEventListener("downloadprogress", console.log);
        } : undefined
      });

      if (available === "after-download") await translator.ready;
      
      const translatedText = await translator.translate(message.originalText);
      
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[index] = { 
          ...newMessages[index],
          text: translatedText,
          translated: true
        };
        return newMessages;
      });
    } catch (error) {
      console.error("Translation failed:", error);
    }
  };

  const handleLanguageChange = (index, newLang) => {
    setMessages(prev => {
      const newMessages = [...prev];
      newMessages[index] = { 
        ...newMessages[index],
        targetLanguage: newLang,
        translated: false
      };
      return newMessages;
    });
  };

  const wordCount = (text) => text.trim().split(/\s+/).length;

  return (
    <div className="chatbox">
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index}>
            <div className={`message ${msg.sender === "user" ? "user-msg" : "bot-msg"}`}>
              {msg.text}
              {msg.translated && (
                <div className="translation-note">
                  (Translated from {languageMap[msg.sourceLanguage] || msg.sourceLanguage})
                </div>
              )}
            </div>
            {msg.sender === "user" && (
              <div className="language-info">
                <p>Detected Language: {languageMap[msg.sourceLanguage] || msg.sourceLanguage}</p>
                <select
                  value={msg.targetLanguage}
                  onChange={(e) => handleLanguageChange(index, e.target.value)}
                >
                  {Object.entries(languageMap).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <button onClick={() => handleTranslate(index)}>
                  Translate
                </button>
                {wordCount(msg.originalText) > 150 && (
                  <button onClick={() => handleSummarize(msg.originalText, index)}>
                    Summarize
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

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
    </div>
  );
};

export default Homepage;