const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-900/40 border-b border-red-500/40 px-4 py-2 text-center text-xs text-red-200">
        Los pagos en producción aún no están configurados. Completa la activación de pagos para cobrar de verdad.
      </div>
    );
  }
  if (clientToken.startsWith('pk_test_')) {
    return (
      <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs text-amber-200">
        Modo prueba: todos los cobros en la preview son simulados.
      </div>
    );
  }
  return null;
}