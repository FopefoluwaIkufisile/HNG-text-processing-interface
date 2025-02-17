import { useState } from "react";
import { useEffect } from "react";
import React, { useRef } from "react";

const Homepage = () => {
  const apiToken = process.env.REACT_APP_LANGUAGE_API_TOKEN;
  const [language, setLanguage] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const buttonRef = useRef(null);

  useEffect(() => {
    const detectLanguage = async () => {
        const response = await fetch('https://api.language-detection.com/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`,
            },
            body: JSON.stringify({
                text: "Your sample text here"
            })
        });

        if (response.ok) {
            const data = await response.json();
            setLanguage(data.language); 
        } else {
            console.error('Failed to detect language');
        }
    };

    detectLanguage();
}, [apiToken]);


  const handleSendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { text: input, sender: "user" }]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { text: "This is an automated response.", sender: "bot" },
      ]);
    }, 1000);
  };


  return (
    <>
    <h1>Detected Language is {language}</h1>
      <div className="chatbox">
        <div className="messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.sender === "user" ? "user-msg" : "bot-msg"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
        <div className="input-case">
          <input
            type="text"
            className="input-box"
            onChange={(e) => setInput(e.target.value)}
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
    </>
  );
};

export default Homepage;
