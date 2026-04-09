/**
 * Reusable typography components for blog articles.
 * Use these to write articles with consistent styling.
 *
 * Example usage in an article:
 *   import { P, H2, H3, UL, OL, LI, Strong, Blockquote } from './components';
 *
 *   export default function MyArticle() {
 *     return (
 *       <>
 *         <P>Introduction paragraph...</P>
 *         <H2>Section title</H2>
 *         <P>More text...</P>
 *         <UL>
 *           <LI><Strong>Point one:</Strong> explanation</LI>
 *           <LI><Strong>Point two:</Strong> explanation</LI>
 *         </UL>
 *       </>
 *     );
 *   }
 */

import { Link } from 'react-router-dom';

export function H2({ children }) {
  return (
    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-10 mb-4">
      {children}
    </h2>
  );
}

export function H3({ children }) {
  return (
    <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">
      {children}
    </h3>
  );
}

export function P({ children }) {
  return (
    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-5 text-justify">
      {children}
    </p>
  );
}

export function Strong({ children }) {
  return <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>;
}

export function UL({ children }) {
  return <ul className="list-disc pl-6 space-y-2 mb-6 text-gray-600 dark:text-gray-300">{children}</ul>;
}

export function OL({ children }) {
  return <ol className="list-decimal pl-6 space-y-2 mb-6 text-gray-600 dark:text-gray-300">{children}</ol>;
}

export function LI({ children }) {
  return <li className="leading-relaxed pl-1 text-justify">{children}</li>;
}

export function Blockquote({ children }) {
  return (
    <blockquote className="border-l-4 border-sky-500 pl-5 py-3 my-8 bg-sky-50 dark:bg-sky-900/20 rounded-r-lg">
      <p className="text-gray-700 dark:text-gray-300 italic text-lg">{children}</p>
    </blockquote>
  );
}

export function Divider() {
  return <hr className="my-8 border-gray-200 dark:border-[#2A2A2A]" />;
}

export function InternalLink({ to, children }) {
  return (
    <Link to={to} className="text-sky-600 dark:text-sky-400 font-medium hover:underline">
      {children}
    </Link>
  );
}

export function CTA({ text = 'Prueba Training Track gratis', href = '/register' }) {
  return (
    <div className="my-10 p-6 bg-sky-50 dark:bg-sky-900/20 rounded-2xl border border-sky-200 dark:border-sky-800 text-center">
      <p className="text-gray-700 dark:text-gray-300 mb-4 text-lg">{text}</p>
      <Link
        to={href}
        className="inline-flex px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg"
      >
        Comenzar gratis
      </Link>
    </div>
  );
}

const STORAGE_BASE = 'https://lusirdkixfliydimemre.supabase.co/storage/v1/object/public/blog';

export function Img({ src, alt, caption }) {
  const url = src.startsWith('http') ? src : `${STORAGE_BASE}/${src}`;
  return (
    <figure className="my-8">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className="w-full rounded-2xl shadow-lg"
      />
      {caption && (
        <figcaption className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
