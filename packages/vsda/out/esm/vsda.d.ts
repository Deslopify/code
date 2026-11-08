export declare function sha256Base64(...parts: Uint8Array[]): string;
export declare class signer {
    sign(...args: [arg: string]): string;
}
export declare class validator {
    private state;
    createNewMessage(...args: [arg: string]): string;
    validate(...args: [arg: string]): "ok" | "error";
}
declare const _default: {
    signer: typeof signer;
    validator: typeof validator;
};
export default _default;
//# sourceMappingURL=vsda.d.ts.map