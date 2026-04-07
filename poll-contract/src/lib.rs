#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
pub enum DataKey {
    VoteCount(u32),
    HasVoted(Address),
    Initialized,
    Option(u32),
}

#[contract]
pub struct PollContract;

#[contractimpl]
impl PollContract {
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Initialized, &true);

        // Initialize vote counts
        env.storage().instance().set(&DataKey::VoteCount(0), &0u32);
        env.storage().instance().set(&DataKey::VoteCount(1), &0u32);
        env.storage().instance().set(&DataKey::VoteCount(2), &0u32);

        // Store option names
        env.storage().instance().set(&DataKey::Option(0), &Symbol::new(&env, "Stellar"));
        env.storage().instance().set(&DataKey::Option(1), &Symbol::new(&env, "Ethereum"));
        env.storage().instance().set(&DataKey::Option(2), &Symbol::new(&env, "Solana"));
    }

    pub fn vote(env: Env, voter: Address, option_index: u32) {
        voter.require_auth();

        if option_index > 2 {
            panic!("invalid option");
        }

        let has_voted: bool = env
            .storage()
            .instance()
            .get(&DataKey::HasVoted(voter.clone()))
            .unwrap_or(false);

        if has_voted {
            panic!("already voted");
        }

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::VoteCount(option_index))
            .unwrap_or(0);

        env.storage()
            .instance()
            .set(&DataKey::VoteCount(option_index), &(count + 1));

        env.storage()
            .instance()
            .set(&DataKey::HasVoted(voter), &true);
    }

    pub fn get_votes(env: Env, option_index: u32) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::VoteCount(option_index))
            .unwrap_or(0)
    }

    pub fn get_option(env: Env, option_index: u32) -> Symbol {
        env.storage()
            .instance()
            .get(&DataKey::Option(option_index))
            .unwrap()
    }

    pub fn has_voted(env: Env, voter: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::HasVoted(voter))
            .unwrap_or(false)
    }
}