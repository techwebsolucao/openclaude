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
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

// Plane animations:
const ASCII_PLANE_IDLE = '---✈︎';
const ASCII_PLANE_FRAMES = [
  '   ✈︎',
  '  -✈︎',
  ' --✈︎',
  '---✈︎',
  '--✈︎ ',
  '-✈︎  ',
  '✈︎   ',
];
const COLORS = [
  'cyanBright',
  'magentaBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'redBright'
];

export function MainLoopStatusHeader({ isLoading }: { isLoading?: boolean }) {
  const model = useMainLoopModel();
  const permissionMode = useAppState(s => s.toolPermissionContext.mode);
  const [blink, setBlink] = useState(true);
  const [frame, setFrame] = useState(0);
  
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
    const id = setInterval(() => {
      setBlink(prev => !prev);
    }, 750);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => {
      setFrame(f => (f + 1) % ASCII_PLANE_FRAMES.length);
    }, 150);
    return () => clearInterval(id);
  }, [isLoading]);

  const { output, lastInput, cost } = counterData;
  const ctxWindow = getContextWindowForModel(model, getSdkBetas());
  const ctxUsed = lastInput + output;
  const pct = ctxWindow > 0 ? Math.round((ctxUsed / ctxWindow) * 100) : 0;
  const name = renderModelName(model);
  const costStr = cost >= 0.01 ? `$${cost.toFixed(2)}` : cost > 0 ? `$${cost.toFixed(4)}` : '$0';

  const isPlanMode = permissionMode === 'plan';

  const currentPlane = isLoading ? ASCII_PLANE_FRAMES[frame] : ASCII_PLANE_IDLE;
  // Cycle colors if loading, or blink a single color when idle
  const planeColor = isLoading ? COLORS[frame % COLORS.length] : (blink ? 'cyanBright' : 'blueBright');

  // Space-pad the resulting string so it fully overwrites the previous text 
  // on line re-renders when the terminal output doesn't clear the line.
  const statusLine = `· ${fmtK(ctxUsed)}/${fmtK(ctxWindow)} tokens (${pct}%) · ${costStr}`.padEnd(45, ' ');

  return (
    <Box paddingX={2} marginBottom={0} justifyContent="space-between">
      <Box gap={1}>
        {isPlanMode ? (
          <Text color="cyanBright" backgroundColor={blink ? 'cyan' : undefined} bold={true}>
            ✻ {name}
          </Text>
        ) : (
          <Box>
            <Text color={planeColor as any} bold={true}>{currentPlane}</Text>
            <Text color="claude" bold={true}> {name}</Text>
          </Box>
        )}
        <Text dimColor={true}>
          {statusLine}
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

