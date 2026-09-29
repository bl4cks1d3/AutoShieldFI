use anchor_lang::prelude::*;

#[error_code]
pub enum AutoShieldError {
    #[msg("Parametro invalido")]
    InvalidParameter,
    #[msg("O protocolo esta pausado")]
    Paused,
    #[msg("Operacao nao autorizada")]
    Unauthorized,
    #[msg("Overflow aritmetico")]
    MathOverflow,
    #[msg("Duracao da apolice fora do intervalo permitido (30 a 365 dias)")]
    InvalidDuration,
    #[msg("Valor do veiculo invalido")]
    InvalidVehicleValue,
    #[msg("Texto excede o tamanho maximo")]
    StringTooLong,
    #[msg("Plano de cobertura invalido")]
    InvalidTier,
    #[msg("Liquidez insuficiente no pool para garantir a cobertura")]
    InsufficientPoolCapital,
    #[msg("A apolice nao esta ativa")]
    PolicyNotActive,
    #[msg("A apolice esta fora do periodo de vigencia")]
    OutsideCoveragePeriod,
    #[msg("Ja existe um sinistro em aberto para esta apolice")]
    ClaimAlreadyOpen,
    #[msg("O plano contratado nao cobre este tipo de sinistro")]
    ClaimTypeNotCovered,
    #[msg("Valor solicitado excede o limite de cobertura restante")]
    ClaimExceedsCoverage,
    #[msg("O sinistro nao esta pendente")]
    ClaimNotPending,
    #[msg("O sinistro nao esta aprovado")]
    ClaimNotApproved,
    #[msg("Avaliador ja votou neste sinistro")]
    AlreadyVoted,
    #[msg("Assinante nao e um avaliador do pool")]
    NotAssessor,
    #[msg("A apolice ainda esta vigente")]
    PolicyStillActive,
    #[msg("Sinistro em aberto impede a liquidacao da apolice")]
    OpenClaimBlocksSettlement,
    #[msg("Saldo de cotas insuficiente")]
    InsufficientShares,
    #[msg("Periodo de carencia de saque ainda nao terminou")]
    WithdrawCooldown,
    #[msg("Saque deixaria o pool abaixo do colateral minimo")]
    WithdrawBreaksSolvency,
    #[msg("Valor acima do limite do faucet")]
    FaucetLimit,
    #[msg("Quantidade deve ser maior que zero")]
    ZeroAmount,
    #[msg("Periodo de votacao encerrado")]
    VotingClosed,
    #[msg("Periodo de votacao ainda em andamento")]
    VotingStillOpen,
    #[msg("Este veiculo ja possui uma apolice ativa")]
    VehicleAlreadyInsured,
    #[msg("Hash da placa nao confere com a placa informada")]
    PlateHashMismatch,
    #[msg("Sinistro dentro do periodo de carencia da apolice")]
    ClaimWaitingPeriod,
    #[msg("Avaliador nao pode votar ou vistoriar a propria apolice")]
    AssessorConflict,
    #[msg("A apolice ainda nao passou pela vistoria")]
    PolicyNotInspected,
    #[msg("A vistoria desta apolice ja foi realizada")]
    AlreadyInspected,
    #[msg("Numero de parcelas invalido para a vigencia escolhida")]
    InvalidInstallments,
    #[msg("Todas as parcelas desta apolice ja foram pagas")]
    AlreadyFullyPaid,
    #[msg("Apolice caducada por parcela em atraso")]
    PolicyLapsed,
    #[msg("Nao ha mudanca de governanca pendente")]
    NoPendingChange,
    #[msg("Timelock de governanca ainda nao expirou")]
    TimelockActive,
    #[msg("Assinante nao e a autoridade proposta")]
    NotPendingAuthority,
    #[msg("Saldo insuficiente na tesouraria do protocolo")]
    InsufficientTreasury,
    #[msg("Primeiro aporte abaixo do minimo")]
    FirstDepositTooSmall,
    #[msg("Liquidez livre insuficiente para pagar o sinistro agora")]
    InsufficientLiquidityForClaim,
    #[msg("Cobertura acima do limite de exposicao do pool por apolice")]
    ExposureLimit,
    #[msg("Saque nao solicitado ou acima das cotas solicitadas")]
    WithdrawNotRequested,
    #[msg("Aviso previo de saque ainda em andamento")]
    WithdrawNoticeActive,
    #[msg("Conta ainda em uso e nao pode ser fechada")]
    AccountNotClosable,
    #[msg("Percentual da FIPE invalido (use 90, 100 ou 110)")]
    InvalidFipePct,
    #[msg("Assinante nao e o oraculo de precos do pool")]
    NotOracle,
    #[msg("Variacao do valor FIPE acima do limite por atualizacao")]
    FipeChangeTooLarge,
    #[msg("Nao ha transferencia pendente para esta carteira")]
    NotPendingOwner,
    #[msg("Oficina nao credenciada ou inativa")]
    RepairShopInactive,
    #[msg("Destinatario do pagamento invalido")]
    InvalidPayee,
    #[msg("O sinistro nao foi recusado")]
    ClaimNotRejected,
    #[msg("Este sinistro ja teve recurso")]
    AlreadyAppealed,
    #[msg("Prazo de recurso encerrado")]
    AppealWindowClosed,
    #[msg("Nao ha avaliadores aptos a julgar o recurso")]
    NoAppealAssessors,
    #[msg("Avaliador que votou na primeira rodada nao vota no recurso")]
    AppealConflict,
}
