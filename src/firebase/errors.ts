export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

// This is a custom error that can be thrown when a Firestore permission error
// occurs. It contains the context of the error, which can be used to display
// a more helpful error message to the developer in the Next.js error overlay.
export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;
  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${JSON.stringify(
      context,
      null,
      2
    )}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}
