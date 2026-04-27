import * as React from 'react';
import { useEffect, useState } from 'react';
import { useAppState } from '../state/AppState.js';
import { useMainLoopModel } from '../hooks/useMainLoopModel.js';
import { getSdkBetas, getLastInputTokens } from '../bootstrap/state.js';
import { getTotalOutputTokens, getTotalCost, getTotalInputTokens } from '../cost-tracker.js';
import { getContextWindowForModel } from '../utils/context.js';
import { renderModelName } from '../utils/model/model.js';
import { Box, Text } from '../ink.js';

function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function MainLoopStatusHeader() {
  const model = useMainLoopModel();
  const permissionMode = useAppState(s => s.toolPermissionContext.mode);
  const [blink, setBlink] = useState(true);
  
  const [counterData, setCounterData] = useState(() => ({
    input: getTotalInputTokens(),
    output: getTotalOutputTokens(),
    lastInput: getLastInputTokens(),
    cost: getTotalCost(),
  }));

  useEffect(() => {
    const update = () => {
      setCounterData({
        input: getTotalInputTokens(),
        output: getTotalOutputTokens(),
        lastInput: getLastInputTokens(),
        cost: getTotalCost(),
      });
    };
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (permissionMode !== 'plan') {
      setBlink(true);
      return;
    }
    const id = setInterval(() => {
      setBlink(prev => !prev);
    }, 500);
    return () => clearInterval(id);
  }, [permissionMode]);

  const { output, lastInput, cost } = counterData;
  const ctxWindow = getContextWindowForModel(model, getSdkBetas());
  const ctxUsed = lastInput + output;
  const pct = ctxWindow > 0 ? Math.round((ctxUsed / ctxWindow) * 100) : 0;
  const name = renderModelName(model);
  const costStr = cost >= 0.01 ? `$${cost.toFixed(2)}` : cost > 0 ? `$${cost.toFixed(4)}` : '$0';

  const isPlanMode = permissionMode === 'plan';

  return (
    <Box paddingX={2} marginBottom={0} justifyContent="space-between">
      <Box gap={1}>
        <Text
          color={isPlanMode ? 'cyanBright' : 'claude'}
          backgroundColor={isPlanMode && blink ? 'cyan' : undefined}
          bold={true}
        >
          ✻ {name}
        </Text>
        <Text dimColor={true}>
          {`· ${fmtK(ctxUsed)}/${fmtK(ctxWindow)} tokens (${pct}%) · ${costStr}`}
        </Text>
      </Box>
      {isPlanMode && (
        <Text color="cyanBright" bold={true} backgroundColor={blink ? 'cyan' : undefined}>
           PLAN MODE ACTIVE 
        </Text>
      )}
    </Box>
  );
}
