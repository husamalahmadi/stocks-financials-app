// FILE: client/src/routes/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "../i18n.jsx";
import Home from "./Home.jsx";
import Stock from "./Stock.jsx";
import Contact from "./Contact.jsx";
import AboutUs from "./AboutUs.jsx";

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stock/:ticker" element={<Stock />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<AboutUs />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}