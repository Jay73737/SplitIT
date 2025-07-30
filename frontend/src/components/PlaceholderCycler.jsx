import { useEffect, useState } from "react";


export default function usePlaceholderCycle(messages, interval = 2500) {
  const [text, setText] = useState(messages[0]);

  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      idx = (idx + 1) % messages.length;
      setText(messages[idx]);
    }, interval);
    return () => clearInterval(id);
  }, [messages, interval]);

  return text;
}