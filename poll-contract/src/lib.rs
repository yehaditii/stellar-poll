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
#[cfg(test)]
mod test {
    use super::*;

    use soroban_sdk::{
        testutils::Address as _,
        Address,
    };

    fn setup() -> (Env, PollContractClient<'static>, Address) {
        let env = Env::default();

        let contract_id = env.register_contract(None, PollContract);
        let client = PollContractClient::new(&env, &contract_id);

        let voter = Address::generate(&env);

        (env, client, voter)
    }

    #[test]
    fn test_initialize() {
        let (env, client, _) = setup();

        client.initialize();

        assert_eq!(client.get_votes(&0), 0);
        assert_eq!(client.get_votes(&1), 0);
        assert_eq!(client.get_votes(&2), 0);

        assert_eq!(client.get_option(&0), Symbol::new(&env, "Stellar"));
        assert_eq!(client.get_option(&1), Symbol::new(&env, "Ethereum"));
        assert_eq!(client.get_option(&2), Symbol::new(&env, "Solana"));
    }

    #[test]
    fn test_vote() {
        let (env, client, voter) = setup();

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter, &0);

        assert_eq!(client.get_votes(&0), 1);
        assert!(client.has_voted(&voter));
    }

    #[test]
    #[should_panic(expected = "already voted")]
    fn test_duplicate_vote_rejected() {
        let (env, client, voter) = setup();

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter, &0);
        client.vote(&voter, &1);
    }

    #[test]
    #[should_panic(expected = "invalid option")]
    fn test_invalid_option_rejected() {
        let (env, client, voter) = setup();

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter, &3);
    }

    #[test]
    fn test_multiple_voters() {
        let (env, client, voter1) = setup();

        let voter2 = Address::generate(&env);

        client.initialize();

        env.mock_all_auths();

        client.vote(&voter1, &0);
        client.vote(&voter2, &0);

        assert_eq!(client.get_votes(&0), 2);
        assert!(client.has_voted(&voter1));
        assert!(client.has_voted(&voter2));
    }
}