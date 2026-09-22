import SwiftUI
import SwiftData

@main
struct AileFinansApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
            .modelContainer(for: [
                Expense.self, Income.self, FamilyMember.self,
                Account.self, Vehicle.self, Debt.self,
                Investment.self, Bill.self
            ])
    }
}
