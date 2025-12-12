/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

interface NavbarProps {
  onNavigate: (sectionId: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, searchRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setIsOpen(false);
  };

  const navLinks = [
    { name: "Features", id: "features" },
    { name: "Testimonials", id: "testimonials" },
    { name: "FAQ", id: "faq" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || isOpen
          ? "bg-[#05070A]/80 backdrop-blur-md border-b border-white/5"
          : "bg-transparent border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div
            className="flex-shrink-0 cursor-pointer group"
            onClick={() => searchRef?.current?.focus()}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white">
                <img src="/namehunt.png" alt="namehunt logo"/>
              </div>
              {/* <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-teal-600 group-hover:from-teal-300 group-hover:to-cyan-300 transition-all">
                NameHunt
              </span> */}
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {navLinks.map((link) => (
                <button
                  key={link.name}
                  onClick={() => handleNavClick(link.id)}
                  className="text-slate-400 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  {link.name}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="hidden md:block">
            <button
              onClick={() => searchRef?.current?.focus()}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Start Search
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-white/10 focus:outline-none transition-colors"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <div
        className={`md:hidden absolute w-full bg-[#05070A] border-b border-white/10 transition-all duration-300 ease-in-out origin-top ${
          isOpen
            ? "opacity-100 scale-y-100 max-h-96"
            : "opacity-0 scale-y-0 max-h-0"
        }`}
      >
        <div className="px-4 pt-2 pb-6 space-y-2 sm:px-3">
          {navLinks.map((link) => (
            <button
              key={link.name}
              onClick={() => handleNavClick(link.id)}
              className="text-slate-300 hover:text-white hover:bg-white/5 block w-full text-left px-3 py-4 rounded-md text-base font-medium transition-colors"
            >
              {link.name}
            </button>
          ))}
          <div className="pt-4 mt-4 border-t border-white/10">
            <button
              onClick={() => searchRef?.current?.focus()}
              className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white px-4 py-3 rounded-xl text-base font-bold text-center active:scale-[0.98] transition-transform"
            >
              Start Search
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
