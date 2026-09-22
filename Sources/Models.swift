import Foundation
import SwiftData

@Model final class FamilyMember { var name: String; init(name: String) { self.name = name } }
@Model final class Expense {
    var amount: Double; var currency: String; var category: String; var merchant: String; var date: Date; var paymentMethod: String; var note: String
    init(amount: Double, currency: String = "TRY", category: String, merchant: String = "", date: Date = .now, paymentMethod: String = "", note: String = "") { self.amount=amount; self.currency=currency; self.category=category; self.merchant=merchant; self.date=date; self.paymentMethod=paymentMethod; self.note=note }
}
@Model final class Income { var amount: Double; var currency: String; var source: String; var date: Date; var note: String; init(amount: Double, currency: String="TRY", source: String, date: Date = .now, note: String = "") { self.amount=amount; self.currency=currency; self.source=source; self.date=date; self.note=note } }
@Model final class Account { var name: String; var balance: Double; var currency: String; var type: String; init(name:String,balance:Double=0,currency:String="TRY",type:String){self.name=name;self.balance=balance;self.currency=currency;self.type=type} }
@Model final class Vehicle { var name:String; var brand:String; var modelYear:Int; var currentKilometer:Double; init(name:String,brand:String,modelYear:Int,currentKilometer:Double=0){self.name=name;self.brand=brand;self.modelYear=modelYear;self.currentKilometer=currentKilometer} }
@Model final class Debt { var person:String; var amount:Double; var currency:String; var direction:String; var dueDate:Date?; var note:String; init(person:String,amount:Double,currency:String="TRY",direction:String,dueDate:Date?=nil,note:String=""){self.person=person;self.amount=amount;self.currency=currency;self.direction=direction;self.dueDate=dueDate;self.note=note} }
@Model final class Investment { var name:String; var type:String; var quantity:Double; var averageCost:Double; var currency:String; var lastPrice:Double; var lastUpdated:Date?; init(name:String,type:String,quantity:Double,averageCost:Double,currency:String="TRY",lastPrice:Double=0,lastUpdated:Date?=nil){self.name=name;self.type=type;self.quantity=quantity;self.averageCost=averageCost;self.currency=currency;self.lastPrice=lastPrice;self.lastUpdated=lastUpdated} }
@Model final class Bill { var name:String; var amount:Double; var currency:String; var dueDate:Date; var recurring:Bool; var paid:Bool; init(name:String,amount:Double,currency:String="TRY",dueDate:Date,recurring:Bool=false,paid:Bool=false){self.name=name;self.amount=amount;self.currency=currency;self.dueDate=dueDate;self.recurring=recurring;self.paid=paid} }
