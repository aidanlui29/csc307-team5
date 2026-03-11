import "@testing-library/jest-dom";

// Polyfill TextEncoder/TextDecoder for react-router (Jest/JSDOM)
import { TextEncoder, TextDecoder } from "util";

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
