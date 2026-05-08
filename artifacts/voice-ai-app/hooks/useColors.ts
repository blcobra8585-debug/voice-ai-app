import colors from "@/constants/colors";

/**
 * Always returns dark theme tokens — this app is dark-only.
 */
export function useColors() {
  return colors.dark;
}
