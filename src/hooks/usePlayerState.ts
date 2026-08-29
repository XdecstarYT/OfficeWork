import { useCallback, useState } from "react";
import { loadPlayerState, savePlayerState, type PlayerState } from "../lib/playerState";

export function usePlayerState() {
  const [state, setState] = useState<PlayerState>(() => loadPlayerState());

  const addMoney = useCallback((amount: number) => {
    setState((prev) => {
      const next = { ...prev, money: Math.max(0, prev.money + amount) };
      savePlayerState(next);
      return next;
    });
  }, []);

  return { money: state.money, addMoney };
}
